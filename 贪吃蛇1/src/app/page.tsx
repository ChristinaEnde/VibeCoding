'use client'

import { SnakeGame } from '@/components/snake-game'
import { motion } from 'framer-motion'
import { Github, Heart } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-emerald-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* 顶部标题 */}
      <header className="pt-8 pb-2 px-4">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            贪吃蛇
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            经典像素游戏 · 用方向键享受乐趣
          </p>
        </motion.div>
      </header>

      {/* 游戏主区域 */}
      <main className="flex-1 flex items-start justify-center px-4 py-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full"
        >
          <SnakeGame />
        </motion.div>
      </main>

      {/* 固定底部 footer */}
      <footer className="mt-auto border-t border-border/60 bg-background/60 backdrop-blur">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5 text-rose-400" />
            使用 React + Canvas 构建
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Github className="h-3.5 w-3.5" />
            Source
          </a>
        </div>
      </footer>
    </div>
  )
}
