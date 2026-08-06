# 全平台便签 M5 补充参考：Apple 风视觉方向

## 1. 目的

本文件用于补充 `SPEC_M5_VISUAL_POLISH.md`。

当前 M5 改版方向仍不够高级。下一轮视觉调整建议明确改为：

```text
Apple Notes / iCloud Notes inspired
但不是照抄 Apple Notes
```

目标是让产品更接近苹果系统应用的气质：

```text
克制、清透、内容优先、层级清楚、控件安静
```

不是：

```text
大色块卡片
厚重后台
强阴影
复杂渐变
花哨装饰
```

## 2. 参考来源

### 2.1 Apple 官方设计原则

技术部和设计实现时应优先参考 Apple 官方 HIG：

```text
Apple Human Interface Guidelines
https://developer.apple.com/design/human-interface-guidelines

Apple HIG - Color
https://developer.apple.com/design/human-interface-guidelines/color

Apple HIG - Typography
https://developer.apple.com/design/human-interface-guidelines/typography

Apple HIG - Layout
https://developer.apple.com/design/human-interface-guidelines/layout

Apple HIG - Materials
https://developer.apple.com/design/human-interface-guidelines/materials
```

提炼到本项目：

1. 内容优先，界面元素退后。
2. 信息层级靠留白、字号、轻边框建立，而不是靠重色块。
3. 控件要安静，只有 hover、focus、选中、危险操作时变明显。
4. 背景和前景要有轻微层次，但不能厚重。
5. 图标按钮尺寸、圆角、内边距必须统一。

### 2.2 Apple Notes / iCloud Notes 功能参考

参考：

```text
iCloud Notes Web
https://www.icloud.com/notes

Apple Notes App Store
https://apps.apple.com/us/app/notes/id1110145109

Apple Support - Use Notes
https://support.apple.com/en-us/118442

Apple Support - Add photos, video, and more to notes
https://support.apple.com/guide/iphone/add-photos-video-and-more-iph23f4d9aa9/ios
```

提炼到本项目：

1. 左侧列表 + 右侧编辑区是主结构。
2. 顶部工具栏很轻，图标为主。
3. 编辑区大面积留白，正文是视觉中心。
4. checklist、图片附件、置顶、搜索都是便签自然能力，不应做成复杂后台控件。
5. 图片附件应该像内容的一部分，而不是像文件管理器。

### 2.3 可作为截图观感参考的第三方页面

以下只作为视觉观感参考，不作为功能需求来源：

```text
The Sweet Setup - Apple Notes guide
https://thesweetsetup.com/the-ultimate-guide-to-apple-notes/

Zapier - Best note taking apps for Mac
https://zapier.com/blog/best-note-taking-app-for-mac/
```

重点观察：

1. macOS Notes 的三栏/两栏关系。
2. 列表项不是重卡片，而是轻背景、轻选中态。
3. 选中项可以用暖黄色强调。
4. 编辑区非常干净，不被边框包住。

## 3. 版权和边界

不允许：

1. 复制 Apple Notes 的图标、App 图标、商标或专有视觉资产。
2. 在页面上使用 Apple、iCloud、Notes 等品牌暗示。
3. 完全照抄 Apple Notes 的截图布局。
4. 使用苹果专有字体文件。

允许：

1. 借鉴苹果系统应用的视觉原则。
2. 使用系统字体栈。
3. 使用类似的轻背景、清透面板、柔和选中态。
4. 使用通用线性图标。

## 4. 本项目的新视觉定位

建议给技术部的目标描述：

```text
把当前“普通 Web 应用便签”调整为“像 macOS/iCloud Notes 一样安静、清透、内容优先的私人便签工具”。
```

关键词：

```text
soft
quiet
native-like
content-first
light chrome
warm selection
minimal controls
```

中文解释：

```text
淡背景
轻边框
少色块
暖色选中
输入区大留白
工具栏图标化
按钮不抢戏
移动端像原生 App 页面
```

## 5. 具体视觉规范

### 5.1 全局背景

当前如果仍显得粗糙，建议改为更接近 Apple 系统应用的中性暖灰：

```text
App 背景：#F5F5F7
侧栏背景：#F2F2F4
编辑区背景：#FFFFFF
分隔线：#E5E5EA
主文字：#1D1D1F
次文字：#6E6E73
弱文字：#A1A1A6
主蓝色：#007AFF
暖黄色选中：#FFE08A 或 #FAD961
危险红：#FF3B30
```

要求：

- 页面不能再呈现强烈蓝灰后台感。
- 背景不使用大面积渐变。
- 不使用装饰性光斑、圆球、玻璃拟态过度效果。

### 5.2 字体

Web 端使用系统字体栈：

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "SF Pro Text",
  "PingFang SC",
  "Segoe UI",
  system-ui,
  sans-serif;
```

字号建议：

```text
侧栏 section 标题：12px / 600
列表标题：14px / 600
列表摘要：13px / 400
列表时间：12px / 400
编辑标题：28px / 650
编辑正文：17px / 400 / line-height 1.65
工具栏文字：12px-13px / 500
```

要求：

- 正文不小于 16px。
- 不使用负字距。
- 不用大标题制造“落地页感”。

### 5.3 左侧列表

Apple 风建议：列表更轻，不要每张都像厚重彩色卡片。

建议方案：

1. 默认列表项：接近白色或极浅灰背景。
2. 当前选中项：暖黄色背景，接近 Apple Notes 选中态。
3. 便签颜色：不要整张大面积高饱和填满，可改为：
   - 左侧 3px 色条；或
   - 右上角小色片；或
   - 极淡纸张色背景。
4. 图片缩略图：列表项右侧小缩略图，尺寸 44px-56px，圆角 8px。
5. 待办进度：放在元信息行，弱化显示。

推荐列表项结构：

```text
标题                         [图片缩略图]
正文摘要 / 待办摘要
时间    N 图    2/5
```

尺寸建议：

```text
列表项 padding：12px 14px
列表项圆角：10px-12px
列表项间距：6px-8px
选中态背景：#FFE08A
hover 背景：rgba(0,0,0,0.04)
```

验收标准：

- 列表看起来像 Apple Notes 的 note list，而不是后台卡片列表。
- 未选中的列表项不要全部是大色块。
- 选中态一眼可见。
- 置顶区与普通区用 section 标题和间距区分，不要用强边框盒子。

### 5.4 编辑区

编辑区要接近 Apple Notes 的“白纸输入”。

建议：

```text
编辑区背景：白色
正文最大宽度：760px-820px
编辑区水平 padding：桌面 48px-72px，移动 20px
标题上方留白：24px-32px
标题与正文间距：18px-24px
```

要求：

- 不要把正文放进卡片。
- 不要给编辑区加厚边框。
- 正文区域应像一张干净白纸。
- 保存状态和操作按钮不能抢正文注意力。

标题：

```text
28px
font-weight: 650
color: #1D1D1F
placeholder: #C7C7CC
```

正文：

```text
17px
line-height: 1.65
color: #1D1D1F
placeholder: #C7C7CC
```

### 5.5 顶部工具栏

Apple 风的工具栏应该“轻、图标化、稳定”。

要求：

1. 工具栏高度固定，建议 48px-52px。
2. 图标按钮统一 32px 或 36px 点击区域。
3. 图标 stroke 统一。
4. 默认状态灰色，hover 才出现浅灰背景。
5. 主要操作不要使用大蓝色按钮堆在顶部。
6. 移动端编辑态只保留一个返回按钮。

建议：

- “新建”可以改为图标 + 简短文字，或桌面端文字、移动端图标。
- 回收站、归档、退出都使用同一按钮规格。
- 模式切换可以做成轻量 segmented control，但不要厚重。

### 5.6 搜索框

参考 Apple/iOS 搜索框：

```text
背景：#E9E9ED 或 rgba(118,118,128,0.12)
圆角：10px-12px
高度：32px-36px
图标：左侧 16px
文字：14px
focus：背景变白 + 1px 浅边框或轻 ring
```

验收：

- 搜索框像系统搜索，而不是普通表单输入框。
- 清空按钮位置稳定，不遮挡文字。

### 5.7 图片附件

Apple 风图片附件应更像“内容嵌入”。

建议：

1. 图片入口放在工具栏或正文下方附件区，视觉上统一。
2. 缩略图使用稳定网格。
3. 缩略图圆角 10px。
4. 图片之间间距 8px-10px。
5. 删除按钮为小型圆形浮层按钮，桌面 hover 显示，移动端常驻或点击图片后显示。
6. 预览层背景使用 `rgba(0,0,0,0.72)`，关闭按钮清楚。

图片预览：

```text
背景暗但不纯黑
图片居中
文件名小字显示
关闭按钮 36px 圆形
移动端关闭按钮可点击区域不小于 44px
```

### 5.8 待办

参考 Apple Notes checklist：

```text
圆形 checkbox
选中为系统黄色或蓝色
文字垂直居中
已完成文字轻微变浅 + 删除线可选
```

要求：

- checkbox 和文字必须对齐。
- 待办项高度稳定。
- 空待办项 placeholder 要轻。
- 勾选状态不能过度花哨。

### 5.9 回收站和归档

回收站不要像后台管理页。

建议：

1. 使用同一套列表项样式。
2. 操作按钮更轻。
3. 永久删除保持红色，但默认不做大红按钮。
4. 图片数量提示保留。
5. 删除时间使用弱文字。

## 6. 明确不要做的方向

技术部不要继续往这些方向走：

1. 不要做卡片堆满页面的 SaaS Dashboard 风。
2. 不要所有便签都大面积高饱和背景。
3. 不要强蓝色 ring 到处出现。
4. 不要按钮全是文字胶囊。
5. 不要用大圆角 20px+ 让界面变玩具感。
6. 不要用阴影制造“高级感”。
7. 不要用渐变背景制造“高级感”。
8. 不要把页面做成 landing page。

## 7. 对当前 M5 的调整建议

如果技术部已经完成一版 M5 但仍不满意，建议按以下顺序返工：

### 7.1 先改列表

优先把便签列表从“彩色卡片流”改成 Apple Notes 风列表：

```text
轻底色列表项
选中项暖黄色
小缩略图
弱元信息
置顶/普通 section
```

这是最影响第一眼高级感的地方。

### 7.2 再改编辑区

把编辑区改成白纸感：

```text
大留白
正文最大宽度
标题更大
正文行高更舒适
工具栏更轻
```

### 7.3 最后统一按钮和图标

统一：

```text
按钮尺寸
图标尺寸
hover 背景
focus ring
危险操作颜色
disabled 状态
```

## 8. 技术部交付要求

技术部下一版必须提供截图对比：

```text
1. 当前线上版首页
2. 新版首页
3. 新版编辑区
4. 新版带图片便签
5. 新版待办便签
6. 新版 390px 移动端列表
7. 新版 390px 移动端编辑
8. 新版回收站
```

并说明：

```text
1. 哪些地方参考了 Apple Notes / iCloud Notes。
2. 哪些地方为了本产品的便签颜色做了差异化。
3. 是否移除了重复返回按钮。
4. 是否保留 M2/M3 所有能力。
5. 是否通过 npm run build。
```

## 9. 验收标准

新版通过标准：

1. 第一眼不再像普通后台或粗糙 Web app。
2. 左侧列表接近 Apple Notes 的轻列表感。
3. 编辑区接近 Apple Notes 的白纸输入感。
4. 工具栏控件统一、克制。
5. 色彩更少、更准，只有选中、便签属性和危险操作突出。
6. 移动端像一个干净的原生风页面。
7. 所有 M2/M3 功能无回退。

如果只是换了颜色、加了圆角和阴影，但结构仍然像后台卡片列表，则不通过。
