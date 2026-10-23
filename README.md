# world.execute(me);

一个**纯代码逐帧计算**的网页版音乐可视化 MV —— 没有一张图片素材，没有一段视频素材，画面全部由 Three.js 场景图在浏览器里实时生成。

配乐：**Mili - world.execute (me) ;**
视觉参考：[FrostNovaOrg/world-execute-web](https://github.com/FrostNovaOrg/world-execute-web)（本项目是独立重写的精简版，不是它的分支）

---

## 快速开始

### 本地打开

```bash
# 必须起静态服务，不能双击 index.html
# 原因：用到了 ES module + importmap，file:// 协议下浏览器会拒绝加载模块
python -m http.server 8000
# 然后浏览器打开 http://127.0.0.1:8000/
```

> 需要支持 **WebGL2** 的浏览器（Chrome / Edge / Firefox 现代版本都行）。
> Safari 需要 15+。手机上能跑，但耗电和发热明显。

### 部署到 GitHub Pages

1. 新建一个仓库（比如叫 `world-execute`）
2. 把 `web/` 目录下的**全部内容**上传到仓库根目录
   （注意：是 `web/` 里面的东西，不是 `web` 这层文件夹本身）
3. 仓库 **Settings → Pages → Source: Deploy from a branch → main → /(root) → Save**
4. 等 1~2 分钟，访问 `https://<你的用户名>.github.io/world-execute/`

**注意**：`.nojekyll` 文件必须一起上传（已放在 `web/` 里），否则 GitHub 的 Jekyll 会忽略掉某些文件。

---

## 操作

| 按键 | 作用 |
|---|---|
| `空格` | 播放 / 暂停 |
| `←` `→` | 后退 / 前进 5 秒 |
| `↑` `↓` | 音量 |
| `M` | 静音 |
| `C` | 中文字幕开关 |
| `F` | 全屏 |
| `L` | 歌词面板 |
| `H` | HUD 开关 |
| `Esc` | 退出全屏 |

鼠标移动会显示控制条，静止 2.6 秒后自动隐藏。

---

## 技术实现

### 整体结构

```
web/
├── index.html          页面骨架（光敏警告 / canvas / 歌词 / HUD / 控制条）+ importmap
├── 404.html            GitHub Pages 的 404 页
├── .nojekyll           禁用 Jekyll（GitHub Pages 必需）
├── css/main.css        全部样式（含三个 @font-face、.shotmode 截图模式）
├── data/timing.js      预计算的时间轴数据（window.WX）
├── js/
│   ├── engine.js       音频分析（AnalyserNode）+ 时间轴查询（Timeline）
│   ├── lyrics.js       双语歌词（卡拉OK 逐词填充）
│   └── tw/             ← Three.js 渲染层（ES module）
│       ├── core.js       渲染器 / 后期链 / 材质预设 / 调色板 / 缓动工具
│       ├── camera.js     分镜导演：16 段落 × 每段 3~4 个镜头 + 运镜生成器
│       ├── kit.js        共享资产：程序化纹理、星空、地面、光晕、核心球着色器
│       ├── scenes_a.js   场景 0-3（intro / 代码墙 / 几何 / 振荡环）
│       ├── scenes_b.js   场景 4-12（牢笼 / 有机体 / 镜像 / 振动 / 碎片 / 报错墙 / 刀刃 / 心形 / 虚空）
│       └── main.js       主循环：场景懒构建、切换、音频驱动、HUD、交互
├── vendor/three/       Three.js r160 本地内置（three.module.js + addons）
└── assets/
    ├── audio/          song.mp3（192kbps）+ song.ogg（原始文件）
    ├── fonts/          JetBrainsMono / SpaceGrotesk / NotoSansSC（OFL 许可）
    ├── subs/zh.json    官方中文译词
    └── web/            封面图与 favicon
```

### 时间轴从哪来

不是自己瞎猜的。参考项目公开了 `timing.json`，里面有：

- **BPM 129.999**，全曲恒定 4/4
- **450 个拍点**、**113 个强拍**
- **16 个段落**（intro / inst1 / v1 / pre1 / c1 / v2 / pre2 / c2 / c2x / bridge / inst2 / chant / c3 / love / outro / end）
- **129 行歌词**，带**逐词**的起止时间（396 个词级时间戳）

我把这份数据下载下来，用本地音频做了**拍点对齐校准**（谱通量 + 短时能量扫描 1ms 精度），得到偏移 `-0.119 秒`，然后重新打包成 `data/timing.js`（`window.WX = {...}`），这样不需要 fetch，离线也能用。

### 13 个场景，全部对应歌词意象

每个场景是一个 `THREE.Group`，懒构建、按段落显隐切换。**不是随便套科技感图形，而是逐句对着歌词设计的**：

| # | 场景 | 形态 | 段落 | 对应的歌词 |
|---|---|---|---|---|
| 0 | `sceneIntro` | 自定义着色器核心球 + 两层线框 + 三层刻度环 + 电路走线 + 落下的棋子 + 光柱 | intro | Switch on the power line / Lay down your pieces / OBJECT CREATION / INITIALIZATION |
| 1 | `sceneCode` | 26 列竖直代码墙，8×8 字形图集采样，字符流滚动下落 | inst1 / inst2 | world.execute(me); |
| 2 | `sceneGeometry` | 点云 → 圆环 → 正弦+切线 → 无穷符号，按 secT 逐句切换 | v1 | If I'm a set of points / circle / sine wave / approach infinity |
| 3 | `sceneOscillate` | 22 个沿 z 堆叠的环，半径在交流/直流间切换 | pre1 | To AC to DC / Dizzy dizzy |
| 4 | `sceneCage` | 立方牢笼 12 条棱 + 8 节点球 + 6 半透明面 + 撞壁逃逸粒子 | c1 | Though we are trapped in this strange SIMULATION |
| 5 | `sceneOrganic` | 茄子（带五瓣萼片与茎）/ 番茄（带蒂）/ 花猫（双耳双眼 + 尾巴） | v2 | EGGPLANT / TOMATO / HOUSECAT / NUTRIENTS / ANTIOXIDANTS |
| 6 | `sceneMirror` | 中轴镜面 + 左右双生球（蓝/品红）+ 镜像刻度 | pre2 | Switch my gender / Switch my role |
| 7 | `sceneVibration` | 7 层同心球壳 + 36 条随进度断裂的径向线 + 中心孤点 | c2 | Feel your vibration / But you are gone |
| 8 | `sceneFragments` | 420 个方块按阈值逐个消失 + 扩散消除波 | c2x | Erase the meaningless fragments |
| 9 | `sceneError` | 22×13 破碎砖墙（30% 缺失 + 12% 只剩残角）+ 26 个漂浮红 X | bridge | ILLEGAL ARGUMENTS |
| 10 | `sceneBlade` | 刀刃竖井：8 条竖棱 + 20 条发光刻槽 + 26 片下落刀片 | chant / c3 | EXECUTION / 赐予死刑 |
| 11 | `sceneHeart` | 参数方程心形 + 34 条全息公式线 + 环绕问题球 + 轨道环 | love | 爱的代数表达式 / trapped in LO-O-OVE |
| 12 | `sceneVoid` | 双层点云球壳随进度消散 + 大面积柔光 + 中心残核 | outro / end | （间奏） |

### 分镜导演（解决"镜头死板"）

`camera.js` 里 16 个段落各配 **3~4 个镜头**，按权重切分段落时长，每个镜头是一个位姿函数：

- 运镜生成器：`dolly`（推近）/ `orbit`（环绕）/ `track`（横移）/ `crane`（升降）/ `handheld`（手持漂移）/ `push`（冲刺快推）
- 切镜时 `cutFlash = 1` 触发闪白，每帧衰减 0.12
- 叠加手持抖动（hash 噪声）与强拍 punch（`pow(beat.env, 8) * 0.05`）
- 每段落还有独立的 `fov` 与 `roll`

### 画面怎么算

**渲染管线**（`core.js` 的 `Stage`）：

```
Scene → RenderPass → UnrealBloomPass(strength 0.38 / radius 0.55 / threshold 0.62)
      → 自定义 grade ShaderPass（径向色差 / 色调 / 暗角 / 扫描线 / 颗粒 / 闪白）
      → OutputPass
```

- `toneMapping = ACESFilmicToneMapping`，`toneMappingExposure = 0.70`
- 灯光用物理正确单位（Three r155+）：`DirectionalLight` key + 两个 `PointLight` rim + `AmbientLight`
- 场景切换时 `stage.setPalette(pal)` 同时更新雾色、色调 tint

**音频驱动**：`AnalyserNode`（fftSize 4096）每帧算四个频段能量（sub / bass / mid / high），
- 场景主体随 bass 呼吸
- 强拍时闪白 + 镜头 punch
- 自发光强度随 beat 脉动
- 后期色散强度随 high 上升

### 三条踩过的坑（改代码前务必读）

1. **`emissiveIntensity` 必须 < 1**。超过 1 经 ACES + Bloom 一定烧成纯白，表面细节全部消失。
   一开始给 `0.9~3.2`，画面糊成一片白，调到 `0.26~0.55` 才看清结构。
2. **`PointLight` 的强度单位是坎德拉，不是"1 就够亮"**。给 `26` 在 1~2 米距离等于几十 lux，浅色材质必爆。
   正确值域约 `1.5~6`。
3. **贴近相机的粒子/碎片会糊屏**。粒子若在立方体内均匀撒，相机附近总有几颗被透视放大成挡住半屏的白斑。
   粒子必须用**球壳分布**（`rMin = spread*0.28`），并让尺寸随距离衰减。

---

## 常见问题

**Q: 打开是黑屏 / 一直转圈？**
先确认是用 http 服务打开的（`python -m http.server`），**不能双击 index.html**——ES module + importmap 在 `file://` 下会被浏览器拒绝加载。
再检查 WebGL2 是否可用：地址栏输入 `about:gpu`（Chrome/Edge），看 WebGL2 是否为 Enabled。

**Q: 有声音但画面不动？**
看控制台有没有 CORS 报错。用 http 服务打开即可解决。

**Q: 手机上很卡？**
`main.js` 里有自适应质量：FPS 低于 42 会连续降分辨率（最低 0.45 倍）。也可以在光敏警告页勾选「低动效模式」。

**Q: 能换歌吗？**
可以。把 `assets/audio/song.mp3` 换成你的文件，同时改 `data/timing.js` 里的 `duration` 和歌词时间轴。
不过换歌后拍点和段落就对不上了，需要重新做时间轴。

**Q: 歌词能换语言吗？**
`assets/subs/zh.json` 是中文译词，`data/timing.js` 里的 `lines[].zh` 字段就是从这来的。想换别的语言，改 `lines[].zh` 即可。

---

## 版权与致谢

- **音乐**：Mili - *world.execute (me) ;*
  版权归 [@ProjectMili](https://projectmili.com) 所有。本项目依 [Mili 官方版权规约](https://projectmili.com/copyright-guidelines) 用于非商业同人创作，不提供下载。
- **时间轴数据与中文译词**：来自 [FrostNovaOrg/world-execute-web](https://github.com/FrostNovaOrg/world-execute-web)。该项目使用 **AGPL-3.0** 许可，本项目仅参考其数据文件（timing.json / zh.json），渲染代码为独立实现。
- **Three.js**：r160，MIT 许可，本地内置在 `vendor/three/`。
- **字体**：JetBrains Mono / Space Grotesk / Noto Sans SC，均为 SIL Open Font License 1.1。
- **视觉参考**：原版 MV 由 FrostNovaOrg 用语言模型编写的程序逐帧生成（Three.js / WebGL2 + GLSL，4K 60fps，13015 帧，304 个镜头）。本项目是独立的精简重实现。
