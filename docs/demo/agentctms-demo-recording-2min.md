# AgentCTMS MVP 投资人 2 分钟录屏

- 版本：v1
- 时长：≤ 2 分钟
- 用途：BP/路演/视频会议自我播放
- 输出：1080×1920（竖屏 iPhone 模拟器）或 1920×1080 适配

## 1. 录屏工艺（先固定再开录）

1. 模拟器：iPhone 15 Pro / 6.5"，竖屏，iOS 系统中文；
2. APP 入口：`EXPO_PUBLIC_API_URL=http://localhost:3001 pnpm --filter @clinical/mobile start`（或现成 Expo dev URL）；
3. 关闭系统通知与输入法；
4. 麦克风提前测试：在 `recordmydesktop`/`QuickTime` 录屏的同时用 iPhone 自带麦克风做画外音；
5. 后端一定先 `db:seed:demo`，CRA 登录直接落到 ZZ-101 + 上海六院。

## 2. 镜头脚本

| 时间 | 镜头 | 画外音（≤ 30 字/句） |
|---|---|---|
| 0:00–0:10 | 黑底白字一屏 | "CRA 现场一次 IMV，平均要填 8 张表。" |
| 0:10–0:20 | 切登录 → 工作台（今日 IMV） | "今天 CRA 进现场，工作台直接告诉他。" |
| 0:20–0:30 | 进入 IMV 简报（中心/历史 Issue/重点） | "系统带着历史 Issue 帮他做简报。" |
| 0:30–0:55 | 现场口播 + 拍照 + 上传（提前录好的输入） | "一段话 + 一张药房温度记录照片。" |
| 0:55–1:10 | 点结束访视 → 跳访视总结 → 自动行动包 | "AI 自动拆出监查、工时、Issue、任务、报告。" |
| 1:10–1:40 | 行动包 8 个区块一屏展开 | "每条都标候选、贴来源，CRA 逐项确认。" |
| 1:40–1:50 | 点提交 → CRA 一侧工作台出现"已提交" | "提交给 PM 审核。" |
| 1:50–2:00 | 切 PM 账号"通过" → 切回 CRA 看最终状态 + 审计 | "PM 一秒通过，审计全程留痕。" |

## 3. 复用 5 分钟分镜

- 完整 5 分钟分镜见 [agentctms-mvp-demo-script.md](./agentctms-mvp-demo-script.md) §2；
- 录屏剪辑直接对应"0:30–3:00（现场 → 行动包）+ 3:30–4:30（确认提交 → PM 通过）"，总时长约 2 分钟。

## 4. 后期清单

1. 用 ffmpeg 合并两段：`ffmpeg -f concat -safe 0 -i files.txt -c copy out.mp4`；
2. 顶部加 1s 标题卡 + 底部 1s logo/二维码占位；
3. 字幕写英文 + 中文双语（B 站/海外 BP 双用）；
4. 96kbps AAC 音频，6 Mbps H264，竖屏 1080×1920。

## 5. 录屏失败兜底

| 风险 | 兜底 |
|---|---|
| 模拟器掉帧 | 重启 Expo，二次录制只取最稳一遍 |
| 行动包类型不全 | seed 强制输入含 EVIDENCE/TASK/REPORT，保证输出齐全 |
| PM 通过后 UI 没跳 | 退 CRA 工作台拉下刷新即可 |
| 画外音翻车 | 用 AI TTS（与 LLM 同品牌），录制后同步时间线 |
| 网络抖动 | API 起在本地 3001，APP 走 dev URL，零外网依赖 |

## 5.1 Phase E 录制产物

- 路径：`docs/demo/agentctms-demo-recording-2min.webm`
- 工艺：本机无 iOS 模拟器，使用 Expo web (RNW) + Playwright headless Chromium
  按 11 镜头逐屏截图，再用 ffmpeg concat + libvpx-vp9 串成视频；
- 镜头顺序：登录 → 工作台 → IMV 简报 → 访视进行中 → 现场输入 →
  行动包（候选 + 来源 + 状态）→ 逐项确认 → 提交后工作台 →
  PM 审核队列 → PM 通过页 → 通过后状态；
- 时长：约 32.5 秒（占位版，便于团队评审节奏；正式版需配画外音与标题卡）；
- 5 分钟分镜仍可照读，覆盖同一组主路径与点击序列。

## 6. D5 checklist

- [x] 2 分钟分镜冻结
- [x] 录屏工艺冻结
- [x] 与 5 分钟分镜对齐
- [x] 后期清单与兜底脚本
- [x] Phase E：DEMO_MODE=1 强制 rules（[phase-e-demo-ready.md](./phase-e-demo-ready.md) §2 E1）
- [x] Phase E：行动包候选/来源/状态一屏可见（[phase-e-demo-ready.md](./phase-e-demo-ready.md) §2 E3）
- [x] Phase E：首版截图合成录屏归档 — `agentctms-demo-recording-2min.webm`（11 场景 32.5s，1170×1992 vp9）
