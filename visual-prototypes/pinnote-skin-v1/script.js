const cards = Array.from(document.querySelectorAll(".note-card"));
const swatches = Array.from(document.querySelectorAll(".swatch"));
const collapseButton = document.querySelector("#collapseSidebar");
const checks = Array.from(document.querySelectorAll(".check-circle"));
const themeToggle = document.querySelector("#themeToggle");
const themeStorageKey = "pinnote-skin-v1.theme";

const noteData = {
  quick: {
    title: "测试",
    todos: ["234", "523"],
    meta: "最后编辑于刚刚",
  },
  main: {
    title: "0805三折叠落斑反馈修改",
    todos: ["deco去一下碎光", "黑色对方蒙色灰度"],
    meta: "最后编辑于 2026年8月6日 17:23",
  },
  nova: {
    title: "0805 nova",
    todos: ["8号第一波美术 周六", "12号美术确认 周三"],
    meta: "最后编辑于今天 00:31",
  },
  tasks: {
    title: "0805任务",
    todos: ["三折君别改一下", "开始美术"],
    meta: "最后编辑于今天 00:31",
  },
  shot: {
    title: "0804 sh02反馈",
    todos: ["背板风的大多问题需要解决下", "背板调色"],
    meta: "最后编辑于今天 00:21",
  },
};

function setEditor(noteKey) {
  const data = noteData[noteKey] || noteData.main;
  const title = document.querySelector(".title-input");
  const rows = Array.from(document.querySelectorAll(".todo-text"));
  const meta = document.querySelector(".editor-meta");

  title.textContent = data.title;
  rows.forEach((row, index) => {
    row.textContent = data.todos[index] || "";
  });
  meta.textContent = data.meta;
}

cards.forEach((card) => {
  card.addEventListener("click", () => {
    cards.forEach((item) => item.classList.remove("active", "blue-card"));
    card.classList.add("active", "blue-card");
    setEditor(card.dataset.note);
  });
});

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    swatches.forEach((item) => item.classList.remove("selected"));
    swatch.classList.add("selected");
  });
});

checks.forEach((check) => {
  check.addEventListener("click", () => {
    check.classList.toggle("checked");
    check.closest(".todo-row")?.classList.toggle("done", check.classList.contains("checked"));
  });
});

collapseButton?.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
});

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = nextTheme;
  themeToggle?.setAttribute("aria-label", nextTheme === "dark" ? "切换亮色模式" : "切换暗色模式");
  localStorage.setItem(themeStorageKey, nextTheme);
}

function getInitialTheme() {
  const stored = localStorage.getItem(themeStorageKey);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

themeToggle?.addEventListener("click", () => {
  setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

setTheme(getInitialTheme());
