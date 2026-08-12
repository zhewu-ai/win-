/**
 * M16R1 Phase 1 浏览器验收（puppeteer-core + 本机 Chrome）。
 * 前置：3000 端口已跑最新 dev server；/tmp/m16_ids.txt 含四个测试便签 id；
 *       测试便签需已重置为原始状态（legcheck documentJson=null）。
 * 运行：npx tsx scripts/browser-acceptance.ts
 */
import puppeteer from "puppeteer-core";
import fs from "fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:3000";
const SHOTS = "/tmp/m16-shots";
fs.mkdirSync(SHOTS, { recursive: true });
const ids = JSON.parse(fs.readFileSync("/tmp/m16_ids.txt", "utf8"));
const { legtext, legcheck, newunified } = ids;

let fails = 0;
function assert(name: string, cond: boolean, extra?: string) {
  if (!cond) {
    fails++;
    console.error("FAIL:", name, extra ? ` [${extra}]` : "");
  } else {
    console.log("ok  :", name);
  }
}
const shot = (page: import("puppeteer-core").Page, name: string) =>
  page.screenshot({ path: `${SHOTS}/${name}.png` }).catch(() => {});
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.setDefaultTimeout(15000);

  const dismissAnnouncement = async () => {
    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll("button")).find((b) =>
        b.textContent?.trim() === "知道了"
      );
      el?.click();
    });
    await sleep(400);
  };
  const openNote = async (id: string) => {
    await page.click(`button[data-note-id="${id}"]`);
    await sleep(900);
  };
  const editorText = () =>
    page.$eval(".ProseMirror", (el) => (el as HTMLElement).innerText).catch(() => null);
  const expandCompleted = async () => {
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((x) =>
        x.getAttribute("title") === "展开已完成"
      );
      b?.click();
    });
    await sleep(400);
  };
  const allRowsText = () =>
    page.$$eval("[data-checklist-block] [data-row-id]", (els) =>
      els.map((e) => (e as HTMLElement).innerText)
    );

  // 登录
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('input[placeholder="请输入邮箱或用户名"]', "admin");
  await page.type('input[placeholder="请输入密码"]', "admin123");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForSelector('button[data-note-id]', { timeout: 15000 });
  await dismissAnnouncement();
  console.log("logged in, list rendered");

  // ══ A. 旧普通便签（documentJson=null, mode=text）══
  await openNote(legtext);
  await page.waitForSelector(".ProseMirror", { timeout: 8000 });
  await shot(page, "A-legacy-text");
  const aText = (await editorText()) ?? "";
  assert("A 旧text: 统一编辑器渲染", true);
  assert("A 旧text: 首行文字", aText.includes("第一行普通文字"), `[${aText.slice(0, 40)}]`);
  assert("A 旧text: 第三行收尾(多行保留)", aText.includes("第三行收尾"));
  const aChip = await page.$eval('span[title="打开便签"]', (el) => el.textContent).catch(() => null);
  assert("A 旧text: 内链芯片渲染", aChip === "内链目标便签", `[${aChip}]`);
  const aUrl = await page.$('a[href="https://example.com/abc"]').then((e) => !!e);
  assert("A 旧text: 外链 <a> 装饰", aUrl);

  // ══ B. 旧待办（documentJson=null, mode=checklist）══
  await openNote(legcheck);
  await page.waitForSelector("[data-checklist-block]", { timeout: 8000 });
  await expandCompleted();
  const bRows = await page.$$eval("[data-checklist-block] [data-row-id]", (els) => els.length);
  assert("B 旧待办: 展开后 3 行全渲染", bRows === 3, `got ${bRows}`);
  const bJoin = (await allRowsText()).join("|");
  assert("B 旧待办: 买牛奶/写周报/本周", bJoin.includes("买牛奶") && bJoin.includes("写周报") && bJoin.includes("本周"));
  const bCheck2 = await page.$('[data-row-id="L2"] button[title="标记为未完成"]').then((e) => !!e);
  assert("B 旧待办: 写周报已勾选", bCheck2);
  // 小标题行应无勾选框（hover 删除按钮 title=删除 是合法存在，仅检查 标记为* 勾选框）
  const bHead = await page.$('[data-row-id="L3"] button[title^="标记为"]').then((e) => !!e);
  assert("B 旧待办: 小标题行无勾选框", !bHead);
  await shot(page, "B-legacy-checklist");

  // ══ C. 新统一文档（documentJson 混合块）══
  await openNote(newunified);
  await page.waitForSelector("[data-checklist-block]", { timeout: 8000 });
  await expandCompleted();
  const cText = (await editorText()) ?? "";
  assert("C 新文档: 开头段落", cText.includes("统一文档开头段落"));
  assert("C 新文档: 结尾段落", cText.includes("结尾段落"));
  const cRows = await page.$$eval("[data-checklist-block] [data-row-id]", (els) => els.length);
  assert("C 新文档: 待办块展开后 2 行", cRows === 2, `got ${cRows}`);
  await shot(page, "C-new-unified");

  // ══ D. 勾选 + 刷新持久化（L1 买牛奶；legacy → 触发 upgrade-on-save 写 documentJson）══
  await openNote(legcheck);
  await page.waitForSelector('[data-row-id="L1"] button[title="标记为已完成"]', { timeout: 8000 });
  await page.click('[data-row-id="L1"] button[title="标记为已完成"]');
  await sleep(2500); // 等防抖保存
  await shot(page, "D-checked-before-reload");
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('button[data-note-id]', { timeout: 15000 });
  await dismissAnnouncement();
  await openNote(legcheck);
  await page.waitForSelector("[data-checklist-block]", { timeout: 8000 });
  await expandCompleted();
  const dJoin = (await allRowsText()).join("|");
  assert("D 勾选后刷新: 买牛奶进入已完成区", dJoin.includes("买牛奶"));
  const dCheckedBtn = await page.$('[data-row-id="L1"] button[title="标记为未完成"]').then((e) => !!e);
  assert("D 勾选后刷新: L1 保持勾选态", dCheckedBtn);
  await shot(page, "D-after-reload");

  // ══ E. 待办块尾空行回车 → 退出到正文段落（新文档 C 上测）══
  await openNote(newunified);
  await page.waitForSelector("[data-checklist-block]", { timeout: 8000 });
  // 在 U1 待办文本末尾回车 → 新增空行
  await page.evaluate(() => {
    const row = document.querySelector('[data-row-id="U1"]');
    const ce = row?.querySelector("[contenteditable=true]") as HTMLElement | null;
    ce?.focus();
  });
  await sleep(300);
  await page.keyboard.press("End");
  await page.keyboard.press("Enter"); // addTodoAfter → 新空行
  await sleep(500);
  // 聚焦最后可见空行 → 回车 → 退出块
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("[data-checklist-block] [data-row-id]"));
    const last = rows[rows.length - 1] as HTMLElement;
    const ce = last.querySelector("[contenteditable=true]") as HTMLElement | null;
    ce?.focus();
  });
  await sleep(300);
  await page.keyboard.press("Enter"); // 空末行回车 → exitBlock
  await sleep(900);
  const eTop = await page.$$eval(".ProseMirror > *", (els) =>
    els.map((e) => (e.hasAttribute("data-checklist-block") ? "CB" : e.tagName)).join(",")
  );
  const eHasPara = await page.$$eval(".ProseMirror > div:not([data-checklist-block])", (els) => els.length > 0);
  assert("E 块尾回车: 出现新正文段落", eHasPara, eTop);
  await shot(page, "E-exit-block");

  // ══ F. 多行输入 + 刷新持久化（旧 text 便签，末尾追加，保留内链供 G 复用）══
  await openNote(legtext);
  await page.waitForSelector(".ProseMirror", { timeout: 8000 });
  await page.evaluate(() => {
    (document.querySelector(".ProseMirror") as HTMLElement | null)?.focus();
  });
  await sleep(300);
  await page.keyboard.press("End");
  await page.keyboard.type("粘贴第一行");
  await page.keyboard.press("Enter");
  await page.keyboard.type("粘贴第二行");
  await sleep(1500);
  await shot(page, "F-typed-multiline");
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('button[data-note-id]', { timeout: 15000 });
  await dismissAnnouncement();
  await openNote(legtext);
  await page.waitForSelector(".ProseMirror", { timeout: 8000 });
  const fText = (await editorText()) ?? "";
  assert("F 多行输入: 两行都在", fText.includes("粘贴第一行") && fText.includes("粘贴第二行"), `[${fText.slice(0, 60)}]`);
  assert("F 刷新后: 两行仍保留", fText.includes("粘贴第一行"));

  // ══ G. 内链芯片点击 → 打开目标便签 ══
  await openNote(legtext);
  await page.waitForSelector('span[title="打开便签"]', { timeout: 8000 });
  await page.evaluate(() => {
    (document.querySelector('span[title="打开便签"]') as HTMLElement | null)?.click();
  });
  await sleep(1500);
  const gText = (await editorText()) ?? "";
  assert("G 内链点击: 打开目标便签", gText.includes("这是被引用的目标"), `[${gText.slice(0, 40)}]`);
  await shot(page, "G-open-link");

  // ══ H. ?m16=legacy 回滚 → 旧双模式编辑器 ══
  await page.goto(`${BASE}/?m16=legacy`, { waitUntil: "networkidle2" });
  await page.waitForSelector('button[data-note-id]', { timeout: 15000 });
  await dismissAnnouncement();
  await openNote(legtext);
  await page.waitForSelector(".ProseMirror", { timeout: 8000 });
  const hModeBtn = await page.$('button[title="切换到待办清单"]').then((e) => !!e);
  assert("H 回滚: 旧 text 编辑器显示模式切换按钮", hModeBtn);
  await shot(page, "H-legacy-text");
  await openNote(legcheck);
  await sleep(1200);
  const hCb = await page.$("[data-checklist-block]").then((e) => !!e);
  const hModeBtn2 = await page.$('button[title="切换到普通便签"]').then((e) => !!e);
  assert("H 回滚: 旧待办无统一块节点视图", !hCb);
  assert("H 回滚: 旧待办显示模式切换按钮", hModeBtn2);
  await shot(page, "H-legacy-checklist");

  // ══ I. 新建待办下拉 → 创建默认含 checklist block 的文档（回到统一模式，清掉 H 的 ?m16=legacy）══
  await page.goto(`${BASE}/`, { waitUntil: "networkidle2" });
  await page.waitForSelector('button[data-note-id]', { timeout: 15000 });
  await dismissAnnouncement();
  const beforeIds = await page.$$eval("button[data-note-id]", (els) =>
    els.map((e) => e.getAttribute("data-note-id"))
  );
  await page.click('button[title="新建"]');
  await sleep(400);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((x) => x.textContent?.trim() === "新建待办");
    (b as HTMLButtonElement | undefined)?.click();
  });
  await sleep(1500);
  await page.waitForSelector("[data-checklist-block]", { timeout: 8000 });
  const iRows = await page.$$eval("[data-checklist-block] [data-row-id]", (els) => els.length);
  assert("I 新建待办: 打开后渲染待办块", iRows >= 1, `got ${iRows}`);
  await shot(page, "I-new-todo");
  // 清理：删掉刚创建的测试待办（列表里新建前不存在的那个 id）
  const afterIds = await page.$$eval("button[data-note-id]", (els) =>
    els.map((e) => e.getAttribute("data-note-id"))
  );
  const iNewId = afterIds.find((id) => !beforeIds.includes(id)) ?? null;
  if (iNewId) {
    await page.evaluate((id) => fetch(`/api/notes/${id}`, { method: "DELETE" }), iNewId).catch(() => {});
    await sleep(400);
  }

  // ══ J. 正文工具栏「插入待办清单」→ 普通便签出现待办块 ══
  await openNote(legtext);
  await page.waitForSelector(".ProseMirror", { timeout: 8000 });
  await page.click('button[title="插入待办清单"]');
  await sleep(900);
  const jBlocks = await page.$$eval(".ProseMirror [data-checklist-block]", (els) => els.length);
  assert("J 插入待办: 正文出现待办块", jBlocks >= 1, `got ${jBlocks}`);
  const jRows = await page.$$eval("[data-checklist-block] [data-row-id]", (els) => els.length);
  assert("J 插入待办: 含一行可编辑行", jRows >= 1, `got ${jRows}`);
  await shot(page, "J-insert-checklist");

  // ══ K. 统一待办更多菜单有「插入便签链接」（不再按 mode=text 隐藏）══
  await openNote(legcheck);
  await page.waitForSelector("[data-checklist-block]", { timeout: 8000 });
  // 侧栏与编辑器各有一个「更多操作」按钮，点编辑器面板（DOM 中最后一个）的
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[title="更多操作"]'));
    (btns[btns.length - 1] as HTMLElement | undefined)?.click();
  });
  await sleep(400);
  const kHasLink = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.trim() === "插入便签链接")
  );
  assert("K 统一待办: 更多菜单有插入便签链接", kHasLink);
  await page.keyboard.press("Escape");

  // ══ L. 格式工具栏：加粗 + 标题 + 分割线 → 刷新持久化 ══
  // 直接 API 建空白便签测格式（单段落文档，避免跨待办块定位光标 + 长会话 UI 下拉抖动）
  const lNewId = (await page.evaluate(() =>
    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "验收-格式测试L", content: "", mode: "text" }),
    })
      .then((r) => r.json())
      .then((d) => d.id)
  )) as string;
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('button[data-note-id]', { timeout: 15000 });
  await dismissAnnouncement();
  await openNote(lNewId);
  await page.waitForSelector(".ProseMirror", { timeout: 8000 });
  await page.evaluate(() => {
    (document.querySelector(".ProseMirror") as HTMLElement | null)?.focus();
  });
  await sleep(300);
  await page.keyboard.type("格式测试文本");
  await page.keyboard.down("Meta");
  await page.keyboard.press("KeyA"); // 选中整段
  await page.keyboard.up("Meta");
  await sleep(200);
  await page.click('button[title="加粗"]');
  await sleep(400);
  const lStrong = await page.$eval(".ProseMirror strong", (el) => el.textContent).catch(() => null);
  assert("L 加粗: strong 出现", lStrong === "格式测试文本", `[${lStrong}]`);
  await page.click('button[title="标题"]');
  await sleep(400);
  const lH2 = await page.$eval(".ProseMirror h2[data-heading]", (el) => el.textContent).catch(() => null);
  assert("L 标题: h2 出现", lH2 === "格式测试文本", `[${lH2}]`);
  // 折叠选区到 h2 文本末尾再插分割线，避免选中文本被替换
  await page.evaluate(() => {
    (document.querySelector(".ProseMirror") as HTMLElement | null)?.focus();
  });
  await sleep(200);
  await page.keyboard.press("ArrowRight");
  await page.click('button[title="分割线"]');
  await sleep(500);
  const lHr = await page.$("hr[data-divider]").then((e) => !!e);
  assert("L 分割线: hr 出现", lHr);
  await shot(page, "L-format-toolbar");
  await sleep(1500); // 等防抖保存
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('button[data-note-id]', { timeout: 15000 });
  await dismissAnnouncement();
  await openNote(lNewId);
  await page.waitForSelector(".ProseMirror", { timeout: 8000 });
  const lStrong2 = await page.$eval(".ProseMirror h2 strong", (el) => el.textContent).catch(() => null);
  assert("L 刷新后: h2+strong 持久化", lStrong2 === "格式测试文本", `[${lStrong2}]`);
  const lHr2 = await page.$("hr[data-divider]").then((e) => !!e);
  assert("L 刷新后: 分割线持久化", lHr2);
  await shot(page, "L-after-reload");

  // ══ M. 格式工具栏：斜体 + 引用 → 刷新持久化 ══
  const mNewId = (await page.evaluate(() =>
    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "验收-格式测试M", content: "", mode: "text" }),
    })
      .then((r) => r.json())
      .then((d) => d.id)
  )) as string;
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('button[data-note-id]', { timeout: 15000 });
  await dismissAnnouncement();
  await openNote(mNewId);
  await page.waitForSelector(".ProseMirror", { timeout: 8000 });
  await page.evaluate(() => {
    (document.querySelector(".ProseMirror") as HTMLElement | null)?.focus();
  });
  await sleep(300);
  await page.keyboard.type("引用格式测试");
  await page.keyboard.down("Meta");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Meta");
  await sleep(200);
  await page.click('button[title="斜体"]');
  await sleep(400);
  const mEm = await page.$eval(".ProseMirror em", (el) => el.textContent).catch(() => null);
  assert("M 斜体: em 出现", mEm === "引用格式测试", `[${mEm}]`);
  await page.click('button[title="引用"]');
  await sleep(400);
  const mQuote = await page.$eval("blockquote[data-quote]", (el) => el.textContent).catch(() => null);
  assert("M 引用: blockquote 出现", mQuote === "引用格式测试", `[${mQuote}]`);
  await shot(page, "M-quote-italic");
  await sleep(1500);
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector('button[data-note-id]', { timeout: 15000 });
  await dismissAnnouncement();
  await openNote(mNewId);
  await page.waitForSelector(".ProseMirror", { timeout: 8000 });
  const mQuote2 = await page.$eval("blockquote[data-quote] em", (el) => el.textContent).catch(() => null);
  assert("M 刷新后: 引用+斜体持久化", mQuote2 === "引用格式测试", `[${mQuote2}]`);
  await shot(page, "M-after-reload");

  // 清理 L/M 新建的测试便签
  for (const id of [lNewId, mNewId]) {
    if (id) {
      await page.evaluate((nid) => fetch(`/api/notes/${nid}`, { method: "DELETE" }), id).catch(() => {});
      await sleep(300);
    }
  }

  await browser.close();
  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
