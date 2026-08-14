param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\docs\presentations")
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
$uiImage = Join-Path $root "UI-REFERENCE.png"

New-Item -ItemType Directory -Force -Path $output | Out-Null

$colors = @{
  Ink    = 0x3B3423
  Deep   = 0x423F26
  Green  = 0x759E2F
  Mint   = 0xEBF3DF
  Orange = 0x3C9AE8
  Paper  = 0xF6F8F7
  White  = 0xFFFFFF
  Gray   = 0x7B7566
  Light  = 0xE8EAE5
  Red    = 0x4A5BC7
}

function Add-Text {
  param($Slide, [string]$Text, [double]$Left, [double]$Top, [double]$Width, [double]$Height,
    [double]$Size = 18, [int]$Color = $colors.Ink, [bool]$Bold = $false,
    [int]$Align = 1, [string]$Font = "Aptos", [double]$Margin = 0)
  $shape = $Slide.Shapes.AddTextbox(1, $Left, $Top, $Width, $Height)
  $shape.TextFrame2.MarginLeft = $Margin
  $shape.TextFrame2.MarginRight = $Margin
  $shape.TextFrame2.MarginTop = $Margin
  $shape.TextFrame2.MarginBottom = $Margin
  $range = $shape.TextFrame.TextRange
  $range.Text = $Text
  $range.Font.Name = $Font
  $range.Font.Size = $Size
  $range.Font.Bold = $(if ($Bold) { -1 } else { 0 })
  $range.Font.Color.RGB = $Color
  $range.ParagraphFormat.Alignment = $Align
  return $shape
}

function Add-Rect {
  param($Slide, [double]$Left, [double]$Top, [double]$Width, [double]$Height,
    [int]$Fill = $colors.White, [int]$Line = $colors.Light, [double]$Radius = 0)
  $type = if ($Radius -gt 0) { 5 } else { 1 }
  $shape = $Slide.Shapes.AddShape($type, $Left, $Top, $Width, $Height)
  $shape.Fill.ForeColor.RGB = $Fill
  $shape.Line.ForeColor.RGB = $Line
  $shape.Line.Weight = 0.75
  return $shape
}

function Add-Line {
  param($Slide, [double]$X1, [double]$Y1, [double]$X2, [double]$Y2,
    [int]$Color = $colors.Green, [double]$Weight = 2)
  $line = $Slide.Shapes.AddLine($X1, $Y1, $X2, $Y2)
  $line.Line.ForeColor.RGB = $Color
  $line.Line.Weight = $Weight
  return $line
}

function Add-Header {
  param($Slide, [string]$Section, [string]$Title, [int]$Number, [bool]$Chinese)
  Add-Text $Slide $Section 42 20 650 18 9 $colors.Green $true 1 | Out-Null
  Add-Text $Slide $Title 42 44 770 45 26 $colors.Ink $true 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos Display" }) | Out-Null
  Add-Line $Slide 42 97 918 97 $colors.Light 1 | Out-Null
  Add-Text $Slide ("{0:00}" -f $Number) 890 20 28 18 9 $colors.Gray $true 3 | Out-Null
}

function Add-Footer {
  param($Slide, [bool]$Chinese)
  $label = if ($Chinese) { "HIGHLIGHTED FLOW PATH SOFTWARE · 客户演示" } else { "HIGHLIGHTED FLOW PATH SOFTWARE · CUSTOMER PRESENTATION" }
  Add-Text $Slide $label 42 518 500 14 7 $colors.Gray $true 1 | Out-Null
}

function Add-Notes {
  param($Slide, [string]$Notes)
  $placeholder = $null
  foreach ($shape in $Slide.NotesPage.Shapes) {
    if ($shape.PlaceholderFormat.Type -eq 2) {
      $placeholder = $shape
      break
    }
  }
  if ($null -ne $placeholder) {
    $placeholder.TextFrame.TextRange.Text = $Notes
  }
}

function Add-BulletList {
  param($Slide, [string[]]$Items, [double]$Left, [double]$Top, [double]$Width,
    [double]$RowHeight = 50, [bool]$Chinese = $true, [double]$Size = 17)
  for ($index = 0; $index -lt $Items.Count; $index++) {
    $y = $Top + ($index * $RowHeight)
    $dot = $Slide.Shapes.AddShape(9, $Left, $y + 7, 9, 9)
    $dot.Fill.ForeColor.RGB = if ($index -eq 0) { $colors.Green } else { $colors.Orange }
    $dot.Line.Visible = 0
    Add-Text $Slide $Items[$index] ($Left + 22) $y ($Width - 22) ($RowHeight - 4) $Size $colors.Ink $false 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
  }
}

function Add-ProcessFlow {
  param($Slide, [string[]]$Labels, [double]$Top, [bool]$Chinese)
  $left = 52
  $boxWidth = 150
  for ($index = 0; $index -lt $Labels.Count; $index++) {
    $x = $left + ($index * 178)
    $fill = if ($index -eq 1 -or $index -eq 2) { $colors.Mint } else { $colors.White }
    $line = if ($index -eq 1 -or $index -eq 2) { $colors.Green } else { $colors.Light }
    Add-Rect $Slide $x $Top $boxWidth 68 $fill $line 4 | Out-Null
    Add-Text $Slide ("0{0}" -f ($index + 1)) ($x + 12) ($Top + 10) 28 15 8 $colors.Green $true 1 | Out-Null
    Add-Text $Slide $Labels[$index] ($x + 12) ($Top + 29) ($boxWidth - 24) 28 14 $colors.Ink $true 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
    if ($index -lt $Labels.Count - 1) {
      Add-Line $Slide ($x + $boxWidth) ($Top + 34) ($x + $boxWidth + 28) ($Top + 34) $colors.Orange 2 | Out-Null
    }
  }
}

function Add-Screenshot {
  param($Slide, [string]$Path, [double]$Left, [double]$Top, [double]$Width, [double]$Height)
  Add-Rect $Slide ($Left - 5) ($Top - 5) ($Width + 10) ($Height + 10) $colors.White $colors.Light 2 | Out-Null
  $Slide.Shapes.AddPicture($Path, 0, -1, $Left, $Top, $Width, $Height) | Out-Null
}

function New-Deck {
  param($PowerPoint, [bool]$Chinese)
  $presentation = $PowerPoint.Presentations.Add()
  $presentation.PageSetup.SlideWidth = 960
  $presentation.PageSetup.SlideHeight = 540

  if ($Chinese) {
    $slides = @(
      @{ Section = "项目定位"; Title = "Highlighted Flow Path Software"; Subtitle = "面向制药工艺设计的 P&ID 数字流路分析与模拟"; Note = "今天介绍的重点不是一套 PDF 工具，而是一套面向设计阶段的 P&ID 数字流路分析与模拟软件。它服务于制药、生物反应器、配液以及 CIP/SIP 系统，帮助工程团队更直观地确认不同工艺阶段下介质经过的路径和设备状态。" },
      @{ Section = "业务挑战"; Title = "复杂 P&ID 让流路判断高度依赖人工"; Bullets = @("管线、阀门、泵、罐体、仪表与远程连接数量庞大", "每个 Phase 的介质路径和设备状态都可能不同", "跨图纸连接、分支与回流路径容易漏看", "设计审查依赖个人经验，沟通成本较高"); Note = "在 CIP/SIP 项目中，难点不是把图纸打开，而是准确理解每个阶段介质实际经过哪里。随着系统规模扩大，人工沿线检查很容易遗漏阀门、支路或跨图连接，结果也较难在不同专业之间快速达成一致。" },
      @{ Section = "业务挑战"; Title = "Phase 越多，重复标注与交付风险越高"; Bullets = @("一个 CIP 流程通常包含几十个 Phase", "每个 Phase 都要重复确认路径与阀门状态", "人工复制、标注和整理页面耗时且容易错序", "数百页报告进一步放大遗漏与版本风险"); Note = "同一张 P&ID 会在不同 Phase 下反复使用，但高亮路径和设备状态不同。如果依靠人工复制和标注，不仅工作量线性增长，还会带来页面遗漏、顺序错误和版本不一致。报告只是这个问题链条的最后一环。" },
      @{ Section = "解决方案"; Title = "从静态图纸到可模拟的数字工艺视图"; Flow = @("数字化 P&ID", "流路分析", "Phase 模拟", "设计审查", "成果交付"); Note = "我们的方案先把 P&ID 作为可交互的工程对象，再围绕流路分析和 Phase 状态模拟开展工作。设计人员完成确认后，结果可用于跨专业审查，并自动沉淀为后续交付资料。" },
      @{ Section = "核心能力"; Title = "数字流路自动高亮模拟"; Bullets = @("选择工艺回路或阶段场景，形成候选流路", "同步突出管线、阀门、泵及关键设备", "结合阀门开关与设备运行状态展示场景", "工程师可复核、调整并保存最终结果"); Note = "这是本项目最核心的能力。系统依据 P&ID 的连接关系辅助形成候选流路，并把相关管线和设备状态直观呈现出来。自动分析用于提高效率和降低遗漏风险，最终结果仍由工程师复核确认。" },
      @{ Section = "核心能力"; Title = "同一张 P&ID，快速切换不同 Phase"; Bullets = @("按【工艺 → 序列 → 阶段】组织 CIP 作业", "每个 Phase 保存流路高亮和设备状态", "阶段切换后快速恢复完整设计场景", "支持大量阶段的顺序管理与复用"); Note = "系统按照实际业务结构管理结果。一个工艺下可以有多个清洗序列，每个序列包含多个阶段。每个阶段保存自己的流路和设备状态，因此工程师可以在同一张图上快速比较预冲洗、循环清洗、排放等不同场景。" },
      @{ Section = "应用范围"; Title = "从 CIP/SIP 延伸至更多制药工艺场景"; Scenarios = @("CIP", "SIP", "配液系统", "生物反应器", "公用工程"); Note = "CIP 和 SIP 是最典型的切入场景，但能力并不局限于清洗。只要业务需要围绕 P&ID 分析介质路径和设备状态，就可以扩展到配液、物料转移、生物反应器以及 WFI、PW、洁净蒸汽等公用工程。" },
      @{ Section = "业务价值"; Title = "让设计审查建立在同一份可视化结果上"; Bullets = @("直观确认介质是否到达预期目标", "辅助检查支路、阀门和远程连接遗漏", "快速比较不同 Phase 的路径与设备状态", "支持工艺、机械、自动化与验证团队协同"); Note = "高亮流路把复杂的设计判断变成所有参与者都能看到的场景。工艺工程师可以确认路径，机械和自动化团队可以核对设备与阀门状态，验证团队也能更早理解设计意图，从而减少反复解释和后期返工。" },
      @{ Section = "成果交付"; Title = "设计结果可直接形成标准化报告"; Bullets = @("按 Sequence 和 Phase 顺序自动组织页面", "支持排除、恢复及原位置换指定页面", "生成一份完整 PDF，或按 Sequence 打包输出", "提供导出检查、进度、取消和失败重试"); Note = "PDF 报告是流路分析成果的一种交付形式。系统能够按照业务顺序自动组织页面，并保留人工调整空间。这样可以降低后期整理工作量，同时减少漏页、错序和版本不一致。" },
      @{ Section = "项目状态"; Title = "当前 Demo、客户验证与后续扩展"; Status = $true; Note = "当前 Demo 已经打通 Phase 管理、状态保存与切换、报告编辑和输出流程。下一步最重要的是使用客户真实 P&ID 验证复杂连接、远程连接和业务规则。审计追踪、电子签名和完整合规能力属于后续范围，当前不作为已实现能力陈述。" },
      @{ Section = "价值总结"; Title = "一条贯穿设计、模拟、审查与交付的数字链路"; Summary = "将 CIP 过程、P&ID 状态与报告输出连接为一条完整的数字化业务链路。"; Note = "总结来说，这套软件的价值是把静态 P&ID 升级为可分析、可模拟、可审查的数字化工程对象。它减少重复劳动和遗漏风险，提高跨专业沟通与交付一致性，并为未来的版本控制、审计和合规扩展打下基础。" }
    )
  }
  else {
    $slides = @(
      @{ Section = "PROJECT POSITIONING"; Title = "Highlighted Flow Path Software"; Subtitle = "Digital P&ID flow analysis and simulation for pharmaceutical process design"; Note = "The focus today is not a PDF utility. It is a design-stage platform for digital P&ID flow analysis and simulation, supporting pharmaceutical, bioreactor, solution preparation, and CIP/SIP systems. It helps engineering teams confirm flow paths and equipment states for each process phase." },
      @{ Section = "BUSINESS CHALLENGE"; Title = "Complex P&IDs make flow analysis heavily manual"; Bullets = @("Large numbers of pipes, valves, pumps, vessels and instruments", "Each phase may require a different route and equipment state", "Branches, returns and off-page connections are easily overlooked", "Design reviews depend heavily on individual experience"); Note = "In CIP and SIP projects, the challenge is not opening the drawing. It is understanding where the medium actually flows in each phase. As system complexity grows, manual tracing can miss valves, branches, and off-page connections, and the result is difficult to communicate consistently across disciplines." },
      @{ Section = "BUSINESS CHALLENGE"; Title = "More phases create more repetitive work and risk"; Bullets = @("A single CIP process may contain dozens of phases", "Every phase requires repeated route and valve-state checks", "Manual copying and annotation consume engineering time", "Hundreds of report pages amplify omissions and version errors"); Note = "The same P&ID is reused across phases, but the highlighted path and equipment states change. Manual copying and annotation scale poorly and introduce missing pages, incorrect sequence, and version inconsistencies. The report is only the final part of this broader workflow problem." },
      @{ Section = "SOLUTION"; Title = "From static drawings to a simulated process view"; Flow = @("Digital P&ID", "Flow analysis", "Phase simulation", "Design review", "Deliverables"); Note = "The solution first turns the P&ID into an interactive engineering object. Flow analysis and phase-state simulation then support design work. Once reviewed, those results can be shared across disciplines and organized into project deliverables." },
      @{ Section = "CORE CAPABILITY"; Title = "Automatic highlighted flow path simulation"; Bullets = @("Select a process route or phase scenario", "Highlight pipes, valves, pumps and key equipment together", "Visualize valve positions and operating equipment states", "Let engineers review, adjust and save the confirmed result"); Note = "This is the central capability. The software uses P&ID connectivity to assist in generating a candidate path and presents the related pipes and equipment states clearly. Automation improves efficiency and reduces omission risk, while final engineering approval remains with the engineer." },
      @{ Section = "CORE CAPABILITY"; Title = "One P&ID, multiple phases, instant context"; Bullets = @("Organize work as Process → Sequence → Phase", "Save flow highlights and equipment states for every phase", "Restore the complete design scenario when switching phases", "Manage and reuse large numbers of phases in order"); Note = "Results are organized according to the actual business process. A process can contain multiple cleaning sequences, and each sequence contains phases. Every phase stores its own path and equipment state, allowing engineers to compare pre-rinse, circulation, discharge, and other scenarios on the same drawing." },
      @{ Section = "APPLICATIONS"; Title = "Applicable across pharmaceutical process systems"; Scenarios = @("CIP", "SIP", "Solution prep", "Bioreactors", "Utilities"); Note = "CIP and SIP are the strongest entry points, but the capability is not limited to cleaning. Any workflow that needs to analyze material paths and equipment states on a P&ID can extend to solution preparation, transfers, bioreactors, WFI, PW, clean steam, and other utilities." },
      @{ Section = "BUSINESS VALUE"; Title = "A shared visual basis for design review"; Bullets = @("Confirm that the medium reaches the intended destination", "Identify missed branches, valves and off-page connections", "Compare routes and equipment states across phases", "Align process, mechanical, automation and validation teams"); Note = "Highlighted paths turn complex design reasoning into a visible scenario for all stakeholders. Process engineers can confirm routes, mechanical and automation teams can verify equipment and valve states, and validation teams can understand design intent earlier, reducing repeated explanation and late rework." },
      @{ Section = "DELIVERABLES"; Title = "Turn approved design states into consistent reports"; Bullets = @("Arrange pages automatically by sequence and phase", "Exclude, restore or replace a page in its original position", "Generate one complete PDF or a packaged set by sequence", "Use pre-checks, progress, cancellation and failed-page retry"); Note = "PDF reporting is one delivery format for approved flow-analysis results. The software follows the business sequence automatically while retaining controlled page adjustments. This reduces manual preparation and lowers the risk of missing pages, incorrect ordering, and inconsistent versions." },
      @{ Section = "PROJECT STATUS"; Title = "Demo today, customer validation next"; Status = $true; Note = "The current demo covers phase management, state saving and switching, report editing, and output. The priority next step is validation with customer P&IDs, especially complex branches, off-page connections, and customer-specific rules. Audit trails, electronic signatures, and full regulatory compliance remain future scope and are not presented as current capabilities." },
      @{ Section = "SUMMARY"; Title = "A digital workflow across design, simulation, review and delivery"; Summary = "Connect CIP processes, P&ID states and report output in one complete digital workflow."; Note = "In summary, the platform upgrades static P&IDs into digital engineering objects that can be analyzed, simulated, reviewed, and delivered. It reduces repetitive work and omission risk, improves cross-discipline communication and delivery consistency, and establishes a foundation for future version, audit, and compliance capabilities." }
    )
  }

  for ($index = 0; $index -lt $slides.Count; $index++) {
    $data = $slides[$index]
    $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
    $slide.FollowMasterBackground = 0
    $slide.Background.Fill.ForeColor.RGB = $colors.Paper

    if ($index -eq 0) {
      $slide.Background.Fill.ForeColor.RGB = $colors.Deep
      Add-Text $slide "FLOWPATH" 50 35 160 18 10 $colors.Green $true 1 | Out-Null
      Add-Text $slide $data.Title 50 95 560 70 34 $colors.White $true 1 "Aptos Display" | Out-Null
      Add-Text $slide $data.Subtitle 50 178 560 55 18 0xE0E3D5 $false 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
      Add-Line $slide 50 262 378 262 $colors.Green 5 | Out-Null
      Add-Text $slide $(if ($Chinese) { "设计阶段 · 数字流路 · 状态模拟" } else { "DESIGN · DIGITAL FLOW · STATE SIMULATION" }) 50 282 500 22 11 $colors.White $true 1 | Out-Null
      $panel = Add-Rect $slide 650 0 310 540 0xEAECE8 0xEAECE8
      $panel.Fill.Transparency = 0.04
      Add-Screenshot $slide $uiImage 625 123 320 219
      Add-Text $slide $(if ($Chinese) { "P&ID 不再只是静态图纸" } else { "BEYOND A STATIC P&ID" }) 650 374 250 25 12 $colors.Ink $true 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
      Add-Text $slide $(if ($Chinese) { "让每个 Phase 的路径与设备状态清晰可见" } else { "Make every phase route and equipment state visible" }) 650 405 275 60 12 $colors.Gray $false 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
    }
    else {
      Add-Header $slide $data.Section $data.Title ($index + 1) $Chinese
      Add-Footer $slide $Chinese
      if ($data.Bullets) {
        Add-BulletList $slide $data.Bullets 54 135 445 70 $Chinese 16
        Add-Screenshot $slide $uiImage 550 145 355 243
        Add-Text $slide $(if ($index -eq 4) { if ($Chinese) { "自动分析辅助工程判断" } else { "AUTOMATION SUPPORTS ENGINEERING JUDGMENT" } } else { if ($Chinese) { "从复杂图纸中建立清晰场景" } else { "TURN COMPLEX DRAWINGS INTO CLEAR SCENARIOS" } }) 550 407 355 32 10 $colors.Green $true 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
      }
      elseif ($data.Flow) {
        Add-ProcessFlow $slide $data.Flow 155 $Chinese
        Add-Text $slide $(if ($Chinese) { "核心工作发生在流路分析与 Phase 模拟，报告是确认结果的交付形式。" } else { "The core work happens in flow analysis and phase simulation; reporting delivers the approved result." }) 90 300 780 65 20 $colors.Ink $true 2 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
        Add-Line $slide 220 404 740 404 $colors.Green 4 | Out-Null
      }
      elseif ($data.Scenarios) {
        for ($scenarioIndex = 0; $scenarioIndex -lt $data.Scenarios.Count; $scenarioIndex++) {
          $x = 62 + ($scenarioIndex * 176)
          $circle = $slide.Shapes.AddShape(9, $x, 155, 92, 92)
          $circle.Fill.ForeColor.RGB = if ($scenarioIndex -eq 0) { $colors.Green } else { $colors.White }
          $circle.Line.ForeColor.RGB = if ($scenarioIndex -eq 0) { $colors.Green } else { $colors.Light }
          Add-Text $slide ("0{0}" -f ($scenarioIndex + 1)) ($x + 31) 181 30 20 11 $(if ($scenarioIndex -eq 0) { $colors.White } else { $colors.Green }) $true 2 | Out-Null
          Add-Text $slide $data.Scenarios[$scenarioIndex] ($x - 20) 267 132 45 15 $colors.Ink $true 2 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
        }
        Add-Text $slide $(if ($Chinese) { "围绕 P&ID 的介质路径与设备状态，形成可复用的行业能力。" } else { "A reusable industry capability built around material paths and equipment states on the P&ID." }) 120 365 720 55 18 $colors.Gray $false 2 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
      }
      elseif ($data.Status) {
        $columns = if ($Chinese) {
          @(
            @{ T = "当前 Demo 已实现"; C = $colors.Green; I = @("Phase 管理与状态切换", "流路与设备状态保存", "报告编辑与两种输出") },
            @{ T = "需客户数据验证"; C = $colors.Orange; I = @("复杂连接识别完整性", "远程连接与业务规则", "大规模性能与准确性") },
            @{ T = "后续可扩展"; C = $colors.Gray; I = @("更完整的自动寻路", "版本与审计追踪", "电子签名与合规验证") }
          )
        }
        else {
          @(
            @{ T = "AVAILABLE IN THE DEMO"; C = $colors.Green; I = @("Phase management and switching", "Saved paths and equipment states", "Report editing and both outputs") },
            @{ T = "CUSTOMER DATA VALIDATION"; C = $colors.Orange; I = @("Complex connectivity coverage", "Off-page links and business rules", "Scale, performance and accuracy") },
            @{ T = "FUTURE EXTENSIONS"; C = $colors.Gray; I = @("Extended automatic pathfinding", "Version and audit controls", "E-signatures and validation") }
          )
        }
        for ($columnIndex = 0; $columnIndex -lt 3; $columnIndex++) {
          $column = $columns[$columnIndex]
          $x = 48 + ($columnIndex * 300)
          Add-Rect $slide $x 135 268 295 $colors.White $colors.Light 3 | Out-Null
          Add-Rect $slide $x 135 268 9 $column.C $column.C | Out-Null
          Add-Text $slide $column.T ($x + 20) 165 230 38 12 $column.C $true 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
          Add-BulletList $slide $column.I ($x + 20) 225 225 58 $Chinese 14
        }
      }
      elseif ($data.Summary) {
        Add-Text $slide "01" 70 150 70 48 30 $colors.Green $true 1 | Out-Null
        Add-Text $slide $(if ($Chinese) { "数字化 P&ID" } else { "DIGITAL P&ID" }) 140 158 220 34 16 $colors.Ink $true 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
        Add-Line $slide 335 174 465 174 $colors.Orange 3 | Out-Null
        Add-Text $slide "02" 486 150 70 48 30 $colors.Green $true 1 | Out-Null
        Add-Text $slide $(if ($Chinese) { "流路模拟与审查" } else { "SIMULATE & REVIEW" }) 556 158 260 34 16 $colors.Ink $true 1 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
        Add-Rect $slide 70 258 820 128 $colors.Deep $colors.Deep 3 | Out-Null
        Add-Text $slide $data.Summary 105 286 750 70 22 $colors.White $true 2 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos Display" }) | Out-Null
        Add-Text $slide $(if ($Chinese) { "降低重复工作 · 减少遗漏风险 · 提升交付一致性" } else { "LESS REPETITION · LOWER OMISSION RISK · CONSISTENT DELIVERY" }) 150 420 660 28 11 $colors.Green $true 2 $(if ($Chinese) { "Microsoft YaHei" } else { "Aptos" }) | Out-Null
      }
    }
    Add-Notes $slide $data.Note
  }

  return $presentation
}

$powerPoint = New-Object -ComObject PowerPoint.Application
$powerPoint.Visible = -1

try {
  $zh = New-Deck $powerPoint $true
  $zhPath = Join-Path $output "Highlighted-Flow-Path-Software-CN.pptx"
  $zh.SaveAs($zhPath, 24)
  $zh.Close()

  $en = New-Deck $powerPoint $false
  $enPath = Join-Path $output "Highlighted-Flow-Path-Software-EN.pptx"
  $en.SaveAs($enPath, 24)
  $en.Close()
}
finally {
  $powerPoint.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) | Out-Null
}

Write-Output "Generated: $zhPath"
Write-Output "Generated: $enPath"