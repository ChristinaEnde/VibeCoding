'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Play,
  Pause,
  RotateCcw,
  Trophy,
  Apple,
  Gamepad2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'

// ---------- 游戏配置 ----------
const GRID_SIZE = 20 // 20 x 20 网格
const CELL = 22 // 每格像素 (canvas 内部分辨率)
const BOARD_PX = GRID_SIZE * CELL
const BASE_SPEED = 140 // 初始移动间隔 ms
const MIN_SPEED = 70 // 最快速度
const SPEED_STEP = 4 // 每吃一颗食物加速量

type Point = { x: number; y: number }
type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Status = 'idle' | 'running' | 'paused' | 'over'

const DIR_VECTORS: Record<Dir, Point> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
}

const OPPOSITE: Record<Dir, Dir> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
}

// 初始蛇位置 (屏幕中间向右)
const INITIAL_SNAKE: Point[] = [
  { x: 9, y: 10 },
  { x: 8, y: 10 },
  { x: 7, y: 10 },
]

function randomFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`))
  let next: Point
  do {
    next = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    }
  } while (occupied.has(`${next.x},${next.y}`))
  return next
}

function speedFromScore(score: number) {
  return Math.max(MIN_SPEED, BASE_SPEED - score * SPEED_STEP)
}

// 圆角矩形辅助函数 (模块作用域, 避免每次渲染重建)
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // 用 ref 保存游戏实时状态，避免重渲染影响 setInterval
  const snakeRef = useRef<Point[]>(INITIAL_SNAKE)
  const foodRef = useRef<Point>(randomFood(INITIAL_SNAKE))
  const dirRef = useRef<Dir>('RIGHT')
  const nextDirRef = useRef<Dir>('RIGHT')
  const scoreRef = useRef(0)
  const statusRef = useRef<Status>('idle')

  // 用于驱动 UI 的状态
  const [status, setStatus] = useState<Status>('idle')
  const [score, setScore] = useState(0)
  // 惰性初始化: 从 localStorage 读取最高分 (客户端组件, 安全访问)
  const [highScore, setHighScore] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    const saved = Number(localStorage.getItem('snake-high-score') || '0')
    return Number.isNaN(saved) ? 0 : saved
  })

  const syncUI = useCallback(() => {
    setStatus(statusRef.current)
    setScore(scoreRef.current)
  }, [])

  // ---------- 绘制 ----------
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 背景
    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, BOARD_PX, BOARD_PX)

    // 棋盘网格 (细线)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * CELL, 0)
      ctx.lineTo(i * CELL, BOARD_PX)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * CELL)
      ctx.lineTo(BOARD_PX, i * CELL)
      ctx.stroke()
    }

    // 食物 (带光晕的圆点)
    const food = foodRef.current
    const fx = food.x * CELL + CELL / 2
    const fy = food.y * CELL + CELL / 2
    const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, CELL)
    glow.addColorStop(0, 'rgba(244,63,94,0.9)')
    glow.addColorStop(1, 'rgba(244,63,94,0)')
    ctx.fillStyle = glow
    ctx.fillRect(food.x * CELL - CELL / 2, food.y * CELL - CELL / 2, CELL * 2, CELL * 2)
    ctx.fillStyle = '#fb7185'
    ctx.beginPath()
    ctx.arc(fx, fy, CELL / 2 - 4, 0, Math.PI * 2)
    ctx.fill()
    // 食物高光
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath()
    ctx.arc(fx - 3, fy - 3, 2, 0, Math.PI * 2)
    ctx.fill()

    // 蛇身
    const snake = snakeRef.current
    snake.forEach((seg, i) => {
      const isHead = i === 0
      const t = i / Math.max(snake.length - 1, 1)
      // 从亮 emerald 渐变到深 teal
      const r = Math.round(16 + (5 - 16) * t)
      const g = Math.round(185 + (120 - 185) * t)
      const b = Math.round(129 + (120 - 129) * t)
      const color = isHead ? '#34d399' : `rgb(${r},${g},${b})`
      ctx.fillStyle = color

      const pad = isHead ? 1 : 2
      roundRect(
        ctx,
        seg.x * CELL + pad,
        seg.y * CELL + pad,
        CELL - pad * 2,
        CELL - pad * 2,
        isHead ? 7 : 5
      )
      ctx.fill()

      // 蛇头眼睛
      if (isHead) {
        const dir = dirRef.current
        const v = DIR_VECTORS[dir]
        const cx = seg.x * CELL + CELL / 2
        const cy = seg.y * CELL + CELL / 2
        const offset = 4
        const eyeOffsetX = v.x !== 0 ? v.x * offset : -3
        const eyeOffsetY = v.y !== 0 ? v.y * offset : -3
        const perpX = v.x !== 0 ? 0 : 4
        const perpY = v.y !== 0 ? 0 : 4
        ctx.fillStyle = '#0b1220'
        ctx.beginPath()
        ctx.arc(cx + eyeOffsetX + perpX, cy + eyeOffsetY + perpY, 2.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(cx + eyeOffsetX - perpX, cy + eyeOffsetY - perpY, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
    })
  }, [])

  // ---------- 游戏状态控制 ----------
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 用 ref 持有最新的 tick 逻辑, 让 interval 始终调用最新版本, 避免循环依赖
  const tickRef = useRef<() => void>(() => {})

  const gameOver = useCallback(() => {
    statusRef.current = 'over'
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    // 更新最高分
    setHighScore((prev) => {
      if (scoreRef.current > prev) {
        localStorage.setItem('snake-high-score', String(scoreRef.current))
        return scoreRef.current
      }
      return prev
    })
    syncUI()
  }, [syncUI])

  const resetGame = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    snakeRef.current = INITIAL_SNAKE.map((p) => ({ ...p }))
    foodRef.current = randomFood(snakeRef.current)
    dirRef.current = 'RIGHT'
    nextDirRef.current = 'RIGHT'
    scoreRef.current = 0
    statusRef.current = 'idle'
    syncUI()
    draw()
  }, [draw, syncUI])

  const startLoop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(
      () => tickRef.current(),
      speedFromScore(scoreRef.current)
    )
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    statusRef.current = 'running'
    syncUI()
    startLoop()
  }, [resetGame, startLoop, syncUI])

  const togglePause = useCallback(() => {
    if (statusRef.current === 'running') {
      statusRef.current = 'paused'
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    } else if (statusRef.current === 'paused') {
      statusRef.current = 'running'
      startLoop()
    }
    syncUI()
  }, [startLoop, syncUI])

  // ---------- 游戏循环 (赋值到 ref, 每次渲染更新闭包) ----------
  const tick = useCallback(() => {
    if (statusRef.current !== 'running') return

    dirRef.current = nextDirRef.current
    const v = DIR_VECTORS[dirRef.current]
    const snake = snakeRef.current
    const head = snake[0]
    const newHead: Point = { x: head.x + v.x, y: head.y + v.y }

    // 撞墙
    if (
      newHead.x < 0 ||
      newHead.x >= GRID_SIZE ||
      newHead.y < 0 ||
      newHead.y >= GRID_SIZE
    ) {
      gameOver()
      return
    }
    // 撞自己 (排除尾巴, 因为尾巴会移动)
    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
        gameOver()
        return
      }
    }

    const newSnake = [newHead, ...snake]
    // 吃食物
    if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
      scoreRef.current += 1
      foodRef.current = randomFood(newSnake)
    } else {
      newSnake.pop()
    }
    snakeRef.current = newSnake
    draw()
    syncUI()
  }, [draw, gameOver, syncUI])

  // 每次渲染把最新的 tick 写入 ref, 让 interval 调用最新逻辑
  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  // 分数变化时按新速度重建定时器
  useEffect(() => {
    if (status === 'running') startLoop()
  }, [score, status, startLoop])

  // ---------- 方向控制 ----------
  const changeDir = useCallback(
    (dir: Dir) => {
      if (statusRef.current !== 'running') return
      // 不能 180 度反向
      if (OPPOSITE[dirRef.current] === dir) return
      nextDirRef.current = dir
    },
    []
  )

  // 键盘控制
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key
      let dir: Dir | null = null
      if (key === 'ArrowUp' || key === 'w' || key === 'W') dir = 'UP'
      else if (key === 'ArrowDown' || key === 's' || key === 'S') dir = 'DOWN'
      else if (key === 'ArrowLeft' || key === 'a' || key === 'A') dir = 'LEFT'
      else if (key === 'ArrowRight' || key === 'd' || key === 'D') dir = 'RIGHT'
      else if (key === ' ') {
        e.preventDefault()
        if (statusRef.current === 'running' || statusRef.current === 'paused') {
          togglePause()
        } else if (statusRef.current === 'idle' || statusRef.current === 'over') {
          startGame()
        }
        return
      }
      if (dir) {
        e.preventDefault()
        changeDir(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [changeDir, startGame, togglePause])

  // 初次绘制 + 卸载清理
  useEffect(() => {
    draw()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [draw])

  const overlay = (() => {
    if (status === 'idle') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/70 backdrop-blur-sm rounded-xl">
          <Gamepad2 className="h-10 w-10 text-emerald-400" />
          <p className="text-lg font-semibold text-white">贪吃蛇</p>
          <p className="text-sm text-slate-300 text-center max-w-xs px-4">
            使用方向键 / WASD 控制移动，空格键暂停
          </p>
          <Button onClick={startGame} size="lg" className="mt-2">
            <Play className="h-4 w-4" /> 开始游戏
          </Button>
        </div>
      )
    }
    if (status === 'paused') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/70 backdrop-blur-sm rounded-xl">
          <Pause className="h-10 w-10 text-amber-400" />
          <p className="text-lg font-semibold text-white">已暂停</p>
          <Button onClick={togglePause} variant="secondary">
            <Play className="h-4 w-4" /> 继续
          </Button>
        </div>
      )
    }
    if (status === 'over') {
      const isNewRecord = score > 0 && score >= highScore
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/75 backdrop-blur-sm rounded-xl">
          <p className="text-lg font-semibold text-white">游戏结束</p>
          {isNewRecord && (
            <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/40">
              <Trophy className="h-3.5 w-3.5 mr-1" /> 新纪录!
            </Badge>
          )}
          <p className="text-sm text-slate-300">
            本局得分 <span className="text-emerald-400 font-bold">{score}</span>
          </p>
          <Button onClick={startGame} size="lg" className="mt-1">
            <RotateCcw className="h-4 w-4" /> 重新开始
          </Button>
        </div>
      )
    }
    return null
  })()

  return (
    <div className="w-full max-w-md mx-auto">
      {/* 分数栏 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="bg-card/60 backdrop-blur">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Apple className="h-4 w-4 text-rose-400" />
              <span className="text-xs text-muted-foreground">当前分数</span>
            </div>
            <span className="text-2xl font-bold tabular-nums text-emerald-500">
              {score}
            </span>
          </CardContent>
        </Card>
        <Card className="bg-card/60 backdrop-blur">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">最高记录</span>
            </div>
            <span className="text-2xl font-bold tabular-nums text-amber-500">
              {highScore}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 游戏画板 */}
      <Card className="p-3 bg-card/40 backdrop-blur">
        <div
          className="relative w-full rounded-xl overflow-hidden border border-slate-800"
          style={{ aspectRatio: '1 / 1' }}
        >
          <canvas
            ref={canvasRef}
            width={BOARD_PX}
            height={BOARD_PX}
            className="block w-full h-full"
            aria-label="贪吃蛇游戏画面"
          />
          <AnimatePresence>{overlay && <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          >
            {overlay}
          </motion.div>}</AnimatePresence>
        </div>
      </Card>

      {/* 控制按钮 */}
      <div className="flex items-center gap-2 mt-4">
        {status === 'running' || status === 'paused' ? (
          <Button onClick={togglePause} variant="secondary" className="flex-1">
            {status === 'running' ? (
              <>
                <Pause className="h-4 w-4" /> 暂停
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> 继续
              </>
            )}
          </Button>
        ) : (
          <Button onClick={startGame} className="flex-1">
            <Play className="h-4 w-4" />
            {status === 'over' ? '重新开始' : '开始游戏'}
          </Button>
        )}
        <Button onClick={resetGame} variant="outline" className="flex-1">
          <RotateCcw className="h-4 w-4" /> 重置
        </Button>
      </div>

      <Separator className="my-5" />

      {/* 移动端方向键 */}
      <div className="flex flex-col items-center gap-2 sm:hidden">
        <DirButton dir="UP" onPress={changeDir} icon={ArrowUp} />
        <div className="flex gap-2">
          <DirButton dir="LEFT" onPress={changeDir} icon={ArrowLeft} />
          <DirButton dir="DOWN" onPress={changeDir} icon={ArrowDown} />
          <DirButton dir="RIGHT" onPress={changeDir} icon={ArrowRight} />
        </div>
      </div>

      {/* 桌面端提示 */}
      <p className="hidden sm:block text-center text-xs text-muted-foreground mt-4">
        方向键 / WASD 控制移动 · 空格键 暂停/继续
      </p>
    </div>
  )
}

function DirButton({
  dir,
  onPress,
  icon: Icon,
}: {
  dir: Dir
  onPress: (d: Dir) => void
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Button
      variant="secondary"
      size="icon"
      className="h-14 w-14 rounded-xl active:scale-95 transition-transform"
      onPointerDown={(e) => {
        e.preventDefault()
        onPress(dir)
      }}
      aria-label={dir}
    >
      <Icon className="h-5 w-5" />
    </Button>
  )
}
