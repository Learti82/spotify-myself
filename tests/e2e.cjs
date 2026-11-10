/* End-to-end test against a running production build.
 * Usage: BASE_URL=http://localhost:3100 PASSCODE=... FIXTURES=dir OUT=dir node tests/e2e.cjs
 * Requires Playwright (preinstalled or `npm i -D playwright`). */
const { chromium, devices } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE = process.env.BASE_URL || "http://localhost:3100";
const PASS = process.env.PASSCODE || "test-passcode";
const FIX = process.env.FIXTURES;
const OUT = process.env.OUT || "test-results";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let page;
async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name} (${Date.now() - t}ms)`);
  } catch (err) {
    results.push({ name, ok: false, err: err.message });
    await page.screenshot({ path: `${OUT}/FAIL-${results.length}.png` }).catch(() => {});
    console.log(`  ✗ ${name}\n      ${err.message.split("\n").slice(0, 4).join("\n      ")}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_INTERNET_DISCONNECTED|youtube|RSC payload/i.test(m.text()) && pageErrors.push(`console: ${m.text()}`));

  const audio = () =>
    page.evaluate(() => {
      const a = document.querySelector('[data-testid="audio-engine"]');
      return { paused: a.paused, t: a.currentTime, src: a.currentSrc, volume: a.volume, duration: a.duration };
    });
  const nowTitle = () => page.locator('[data-testid="now-playing-title"]').innerText();
  const rowTitles = () => page.locator('[data-testid="song-row"] .truncate.text-\\[15px\\]').allInnerTexts();
  const waitPlaying = async () => {
    await page.waitForFunction(() => {
      const a = document.querySelector('[data-testid="audio-engine"]');
      return a && !a.paused && a.currentTime > 0.3;
    }, null, { timeout: 10000 });
  };
  const toast = (text) => page.getByRole("status").filter({ hasText: text }).first();
  const openRowMenu = async (title) => {
    const row = page.locator('[data-testid="song-row"]', { hasText: title }).first();
    await row.hover();
    await row.getByRole("button", { name: `More options for ${title}` }).click();
  };

  console.log("Auth");
  await step("unauthenticated visit redirects to /login", async () => {
    await page.goto(BASE);
    assert(page.url().includes("/login"), `url was ${page.url()}`);
  });
  await step("API is protected without a session", async () => {
    const r = await (await browser.newContext()).request.get(`${BASE}/api/cloud/status`);
    assert(r.status() === 401, `status ${r.status()}`);
  });
  await step("wrong passcode is rejected", async () => {
    await page.fill("#passcode", "nope");
    await page.click("button:has-text('Unlock')");
    await page.getByRole("alert").filter({ hasText: "Wrong passcode" }).waitFor();
  });
  await step("correct passcode unlocks the app", async () => {
    await page.fill("#passcode", PASS);
    await page.click("button:has-text('Unlock')");
    await page.waitForURL(`${BASE}/`);
    await page.getByText("Your library is empty").waitFor();
  });

  console.log("Import");
  await step("import requires rights confirmation", async () => {
    await page.goto(`${BASE}/import`);
    await page.getByTestId("dropzone").click();
    await toast("confirm you have the rights").waitFor();
  });
  await step("imports MP3/FLAC/OGG/WAV with tags, rejects non-audio", async () => {
    await page.getByText("I own these audio files").click();
    const files = ["01 Morning Light.mp3", "02 Night Drive.mp3", "city-rain.flac", "echoes.ogg", "Low Tide - Paper Boats.wav", "notes.txt"].map((f) => path.join(FIX, f));
    await page.getByTestId("file-input").setInputFiles(files);
    await toast("Imported 5 songs").waitFor({ timeout: 30000 });
    const text = await page.getByTestId("import-results").innerText();
    for (const t of ["Morning Light", "Night Drive", "City Rain", "Echoes", "Paper Boats", "Unsupported file type"]) assert(text.includes(t), `missing ${t} in results`);
    assert(text.includes("Aurora Fields · First Dawn"), "ID3 artist/album not parsed");
    assert(text.includes("Low Tide · Unknown Album"), "file-name artist guess failed");
  });
  await step("embedded ID3 artwork is extracted", async () => {
    const imgs = await page.locator('[data-testid="import-results"] img').count();
    assert(imgs >= 1, "no artwork image rendered");
  });

  console.log("Library");
  await step("library lists all songs with offline indicators", async () => {
    await page.goto(`${BASE}/library`);
    await page.locator('[data-testid="song-row"]').nth(4).waitFor();
    assert((await page.locator('[data-testid="song-row"]').count()) === 5, "expected 5 rows");
    assert((await page.locator('[data-testid="song-row"] [data-testid="offline-icon"]').count()) === 5, "expected 5 offline icons");
  });

  console.log("Playback");
  await step("clicking a song plays it", async () => {
    await page.locator('[data-testid="song-row"]', { hasText: "Morning Light" }).click();
    await waitPlaying();
    assert((await nowTitle()) === "Morning Light", `now playing ${await nowTitle()}`);
    assert((await page.getByTestId("duration").innerText()) === "0:20", "duration not shown");
  });
  await step("playback continues while navigating between pages", async () => {
    const before = await audio();
    await page.getByRole("link", { name: "Search", exact: true }).first().click();
    await page.waitForURL(/\/search/);
    await page.getByRole("link", { name: "Liked Songs" }).first().click();
    await page.waitForURL(/\/liked/);
    await sleep(1200);
    const after = await audio();
    assert(!after.paused && after.t > before.t + 0.8 && after.src === before.src, `paused=${after.paused} t ${before.t}->${after.t}`);
  });
  await step("Space toggles play/pause", async () => {
    await page.locator("body").click({ position: { x: 700, y: 20 } });
    await page.keyboard.press("Space");
    await sleep(300);
    assert((await audio()).paused, "should be paused");
    await page.keyboard.press("Space");
    await waitPlaying();
  });
  await step("arrow key seeks forward", async () => {
    const t0 = (await audio()).t;
    await page.keyboard.press("ArrowRight");
    await sleep(200);
    const t1 = (await audio()).t;
    assert(t1 > t0 + 4, `seek ${t0} -> ${t1}`);
  });
  await step("progress bar seek", async () => {
    await page.getByRole("slider", { name: "Seek" }).fill("2");
    await page.getByRole("slider", { name: "Seek" }).dispatchEvent("pointerup");
    await sleep(200);
    const t = (await audio()).t;
    assert(t >= 1.9 && t < 4, `t=${t}`);
  });
  await step("next / previous", async () => {
    // Library order is newest first; Morning Light is last, so Next wraps to the top (paused, like Spotify).
    const titleIs = (t) => page.waitForFunction((x) => document.querySelector('[data-testid="now-playing-title"]').textContent === x, t);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await titleIs("Paper Boats");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await titleIs("Echoes");
    await waitPlaying();
    await page.getByRole("button", { name: "Previous" }).click();
    await titleIs("Paper Boats");
    await waitPlaying();
  });
  await step("volume keys and mute", async () => {
    const v0 = (await audio()).volume;
    await page.keyboard.press("ArrowDown");
    await sleep(100);
    assert((await audio()).volume < v0, "volume did not decrease");
    await page.getByRole("button", { name: "Mute" }).click();
    assert(await page.evaluate(() => document.querySelector('[data-testid="audio-engine"]').muted), "not muted");
    await page.getByRole("button", { name: "Unmute" }).click();
  });
  await step("shuffle and repeat modes cycle", async () => {
    await page.getByRole("button", { name: "Enable shuffle" }).click();
    await page.getByRole("button", { name: "Disable shuffle" }).waitFor();
    await page.getByRole("button", { name: "Disable shuffle" }).click();
    await page.getByRole("button", { name: "Repeat: off" }).click();
    await page.getByRole("button", { name: "Repeat: all" }).click();
    await page.getByRole("button", { name: "Repeat: one" }).waitFor();
  });
  await step("repeat one replays the same track at the end", async () => {
    const title = await nowTitle();
    await page.evaluate(() => {
      const a = document.querySelector('[data-testid="audio-engine"]');
      a.currentTime = a.duration - 0.4;
    });
    await sleep(1800);
    const a = await audio();
    assert((await nowTitle()) === title && a.t < 3 && !a.paused, `title ${await nowTitle()} t=${a.t}`);
    await page.getByRole("button", { name: "Repeat: one" }).click(); // -> off
  });
  await step("automatically plays the next song at the end", async () => {
    const title = await nowTitle();
    await page.evaluate(() => {
      const a = document.querySelector('[data-testid="audio-engine"]');
      a.currentTime = a.duration - 0.4;
    });
    await page.waitForFunction((f) => document.querySelector('[data-testid="now-playing-title"]').textContent !== f, title, { timeout: 8000 });
    await waitPlaying();
  });
  await step("queue panel shows now playing and upcoming", async () => {
    await page.keyboard.press("q");
    const q = page.getByRole("complementary", { name: "Queue" });
    await q.getByText("Now playing").waitFor();
    await page.keyboard.press("q");
  });
  await step("like current song → appears in Liked Songs", async () => {
    const title = await nowTitle();
    await page.getByTestId("player-bar").getByRole("button", { name: "Save to Liked Songs" }).first().click();
    await toast("Added to Liked Songs").waitFor();
    await page.goto(`${BASE}/liked`);
    await page.locator('[data-testid="song-row"]', { hasText: title }).waitFor();
  });

  console.log("Playlists");
  await step("create, rename, add songs", async () => {
    await page.goto(`${BASE}/playlists`);
    await page.getByRole("button", { name: "New playlist" }).click();
    await page.waitForURL(/\/playlist\?id=/);
    await page.getByText("Let's find something for your playlist").waitFor();
    for (const t of ["Morning Light", "City Rain", "Echoes"]) {
      await page.locator("li", { hasText: t }).getByRole("button", { name: "Add" }).click();
      await page.locator('[data-testid="song-row"]', { hasText: t }).waitFor();
    }
    await page.getByRole("heading", { level: 1 }).getByRole("button").click();
    await page.getByRole("dialog").getByLabel("Name").fill("Road Trip");
    await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("heading", { name: "Road Trip" }).waitFor();
    await page.getByText("3 songs").first().waitFor();
  });
  await step("drag and drop reorders songs (persisted)", async () => {
    const before = await rowTitles();
    const handle = page.getByRole("button", { name: `Reorder ${before[0]}` });
    const target = page.getByRole("button", { name: `Reorder ${before[2]}` });
    const hb = await handle.boundingBox();
    const tb = await target.boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + 20, { steps: 5 });
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2 + 10, { steps: 15 });
    await page.mouse.up();
    await sleep(600);
    const after = await rowTitles();
    assert(after[2] === before[0], `order ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    await page.reload();
    await page.locator('[data-testid="song-row"]').nth(2).waitFor();
    const reloaded = await rowTitles();
    assert(JSON.stringify(reloaded) === JSON.stringify(after), `not persisted: ${JSON.stringify(reloaded)}`);
  });
  await step("custom playlist cover", async () => {
    await page.locator('input[type=file][accept="image/*"]').setInputFiles(path.join(FIX, "cover.png"));
    await page.locator("button[aria-label='Change cover'] img").waitFor();
  });
  await step("remove song from playlist", async () => {
    await openRowMenu("Echoes");
    await page.getByRole("menuitem", { name: "Remove from this playlist" }).click();
    await page.getByText("2 songs").first().waitFor();
  });
  await step("play whole playlist and shuffle play", async () => {
    await page.getByRole("button", { name: "Play playlist" }).click();
    await waitPlaying();
    const titles = await rowTitles();
    assert((await nowTitle()) === titles[0], "did not start at first song");
    await page.getByRole("button", { name: "Shuffle play" }).click();
    await waitPlaying();
    await page.getByRole("button", { name: "Disable shuffle" }).click();
  });
  await step("sidebar lists the playlist", async () => {
    await page.getByRole("complementary").getByText("Road Trip").first().waitFor();
  });

  console.log("Search & metadata");
  await step("instant search across songs, artists, albums", async () => {
    await page.goto(`${BASE}/search`);
    await page.fill("#search-input", "aurora");
    const res = page.getByTestId("search-results");
    await res.getByText("Night Drive").first().waitFor();
    await res.getByText("Aurora Fields").first().waitFor();
    await page.getByRole("button", { name: "Albums" }).click();
    await res.getByText("First Dawn").first().waitFor();
    await page.fill("#search-input", "road");
    await page.getByRole("button", { name: "Playlists" }).click();
    await res.getByText("Road Trip").waitFor();
    await page.fill("#search-input", "zzzz");
    await page.getByText('No results found for "zzzz"').waitFor();
  });
  await step("edit song metadata", async () => {
    await page.goto(`${BASE}/library`);
    await openRowMenu("Echoes");
    await page.getByRole("menuitem", { name: "Edit details" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByLabel("Title", { exact: true }).fill("Echoes (Live)");
    await dlg.getByLabel("Genre").fill("Live");
    await dlg.getByRole("button", { name: "Save", exact: true }).click();
    await page.locator('[data-testid="song-row"]', { hasText: "Echoes (Live)" }).waitFor();
  });

  console.log("Sources");
  await step("YouTube: invalid link is rejected", async () => {
    await page.goto(`${BASE}/import?tab=youtube`);
    await page.getByLabel("YouTube URL").fill("https://example.com/watch?v=x");
    await page.getByRole("button", { name: "Look up" }).click();
    await page.getByText("doesn't look like a YouTube video link").waitFor();
  });
  await step("YouTube: lookup returns preview or a clear error", async () => {
    await page.getByLabel("YouTube URL").fill("https://youtu.be/aqz-KE-bpKQ");
    await page.getByRole("button", { name: "Look up" }).click();
    await Promise.race([
      page.getByTestId("youtube-preview").waitFor({ timeout: 15000 }),
      page.locator("p.text-red-400").waitFor({ timeout: 15000 }),
    ]);
    const preview = await page.getByTestId("youtube-preview").count();
    console.log(`      (YouTube reachable from test env: ${preview ? "yes" : "no — error shown"})`);
    if (preview) {
      await page.getByRole("button", { name: "Add to YouTube collection" }).click();
      await page.goto(`${BASE}/library?tab=youtube`);
      await page.locator('[data-testid="song-row"]').first().waitFor();
      assert((await page.locator('[data-testid="song-row"] [data-testid="offline-icon"]').count()) === 0, "YouTube item marked offline");
    }
  });
  await step("authorized download: YouTube and private hosts are refused", async () => {
    await page.goto(`${BASE}/import?tab=url`);
    await page.getByPlaceholder("https://example.org/music/song.mp3").fill("https://www.youtube.com/watch?v=aqz-KE-bpKQ");
    await page.getByText("The source explicitly permits downloading").click();
    await page.getByPlaceholder("e.g. CC BY 4.0").fill("CC BY");
    await page.getByRole("button", { name: /Download & save offline/ }).click();
    await page.getByText("YouTube links can't be downloaded").waitFor();
    await page.getByPlaceholder("https://example.org/music/song.mp3").fill("http://127.0.0.1:3100/x.mp3");
    await page.getByRole("button", { name: /Download & save offline/ }).click();
    await page.getByText("Private network addresses aren't allowed").waitFor();
  });

  console.log("Offline");
  await step("service worker caches the app shell", async () => {
    await page.goto(`${BASE}/`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => {
      const c = await caches.open("pages-v1");
      return (await c.keys()).length >= 12;
    }, null, { timeout: 30000 });
    await page.reload();
    assert(await page.evaluate(() => !!navigator.serviceWorker.controller), "page not controlled by SW");
  });
  await step("app loads and plays with the network disabled", async () => {
    await context.setOffline(true);
    await page.reload();
    await page.getByText("Offline — playing local files").waitFor({ timeout: 10000 });
    await page.goto(`${BASE}/library`);
    await page.locator('[data-testid="song-row"]', { hasText: "City Rain" }).click();
    await waitPlaying();
    assert((await nowTitle()) === "City Rain", "wrong song");
  });
  await step("offline: client navigation, playlists and Offline Music page work", async () => {
    const src = (await audio()).src;
    await page.getByRole("link", { name: "Offline Music" }).first().click();
    await page.getByRole("heading", { name: "Offline Music" }).waitFor({ timeout: 10000 });
    await page.waitForURL(/\/offline/);
    // Next.js keeps previously visited pages mounted but hidden, so count visible rows only.
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="song-row"]')].filter((r) => r.checkVisibility()).length === 5, null, { timeout: 5000 });
    await page.getByRole("link", { name: "Playlists", exact: true }).first().click();
    await page.getByRole("main").getByText("Road Trip").first().click();
    await page.getByRole("heading", { name: "Road Trip" }).waitFor({ timeout: 10000 });
    const a = await audio();
    assert(!a.paused && a.src === src, "audio stopped during offline navigation (page reloaded)");
  });
  await step("remove offline copy keeps the library entry; re-attach restores it", async () => {
    await page.goto(`${BASE}/library`);
    await openRowMenu("Night Drive");
    await page.getByRole("menuitem", { name: "Remove offline copy" }).click();
    await page.getByRole("button", { name: "Remove file" }).click();
    await toast("Removed offline copy").waitFor();
    assert((await page.locator('[data-testid="song-row"]').count()) === 5, "entry was deleted");
    assert((await page.locator('[data-testid="song-row"] [data-testid="offline-icon"]').count()) === 4, "offline icon still shown");
    await openRowMenu("Night Drive");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("menuitem", { name: "Re-attach audio file" }).click();
    await (await chooser).setFiles(path.join(FIX, "02 Night Drive.mp3"));
    await toast("File re-attached").waitFor();
    assert((await page.locator('[data-testid="song-row"] [data-testid="offline-icon"]').count()) === 5, "not offline again");
  });
  await step("remembers queue and position after reload (offline)", async () => {
    await page.evaluate(() => {
      const a = document.querySelector('[data-testid="audio-engine"]');
      a.currentTime = 5;
    });
    await sleep(800);
    await page.reload();
    await page.getByTestId("now-playing-title").waitFor();
    const t = await page.getByTestId("current-time").innerText();
    assert(t !== "0:00", `position not restored (${t})`);
    await page.getByTestId("play-pause").click();
    await waitPlaying();
    assert((await audio()).t >= 4.5, "did not resume from saved position");
    await page.getByTestId("play-pause").click();
  });
  await context.setOffline(false);

  console.log("Responsive");
  // Same context (IndexedDB is per-context), different viewport widths.
  for (const [name, size] of [
    ["mobile", { width: 390, height: 844 }],
    ["tablet", { width: 820, height: 1180 }],
    ["desktop", { width: 1440, height: 900 }],
  ]) {
    await step(`${name}: no horizontal overflow; screenshots`, async () => {
      await page.setViewportSize(size);
      for (const route of ["/", "/library", "/search?q=a", "/playlists", "/offline", "/import"]) {
        await page.goto(BASE + route);
        await sleep(700);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert(overflow <= 1, `${route} overflows by ${overflow}px`);
        await page.screenshot({ path: `${OUT}/${name}${route.replace(/[/?=]/g, "_")}.png` });
      }
      await page.getByRole("link", { name: "Road Trip" }).first().click().catch(() => page.goto(`${BASE}/playlists`));
      await sleep(700);
      await page.screenshot({ path: `${OUT}/${name}_playlist.png` });
      if (name === "mobile") {
        await page.goto(`${BASE}/library`);
        await page.locator('[data-testid="song-row"]').first().click();
        await sleep(500);
        await page.getByRole("button", { name: "Open now playing" }).last().click();
        await sleep(500);
        await page.screenshot({ path: `${OUT}/mobile_now_playing.png` });
        await page.getByRole("button", { name: "Close now playing" }).click();
      }
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log("Cleanup");
  await step("delete song from library", async () => {
    await page.goto(`${BASE}/library`);
    await page.locator('[data-testid="song-row"]').nth(4).waitFor();
    await openRowMenu("Paper Boats");
    await page.getByRole("menuitem", { name: "Delete from library" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await toast("Deleted from your library").waitFor();
    assert((await page.locator('[data-testid="song-row"]').count()) === 4, "not deleted");
  });
  await step("lock app returns to login", async () => {
    await page.goto(`${BASE}/settings`);
    await page.getByRole("button", { name: "Lock app" }).click();
    await page.waitForURL(/\/login/);
  });

  await step("no uncaught page errors", async () => {
    assert(pageErrors.length === 0, pageErrors.slice(0, 5).join("\n"));
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
