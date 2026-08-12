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

  await browser.close();
  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILURES`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e.message);
  process.exit(2);
});
