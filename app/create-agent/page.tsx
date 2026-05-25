"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Sparkles, TestTube, Save, Database, Shield, MessageSquare, Zap, FileText, Plus, X, Search } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ")
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-bold rounded-lg transition-all duration-200 border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
    const variants = {
      default: "bg-[#FF7A00] text-white hover:bg-[#E66D00]",
      outline: "bg-[#FFF4E2] text-black hover:bg-gray-50",
      ghost: "bg-transparent border-transparent shadow-none hover:bg-gray-100 hover:shadow-none"
    }
    const sizes = {
      default: "px-6 py-3 text-base",
      sm: "px-4 py-2 text-sm",
      lg: "px-8 py-4 text-lg"
    }
    return (
      <button ref={ref} className={cn(baseStyles, variants[variant], sizes[size], className)} {...props} />
    )
  }
)
Button.displayName = "Button"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("bg-[#FFF4E2] border-[3px] border-black rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6", className)} {...props} />
  )
)
Card.displayName = "Card"

interface AgentConfig {
  agentName: string
  systemPrompt: string
  tone: string
  domain: string
  responseStyle: string
  guardrails: string[]
  memory: string
}

const FORGE_STEPS = [
  "Analyzing description",
  "Generating system prompt",
  "Configuring guardrails",
  "Setting memory mode"
]

interface ModalTool {
  name: string
  description: string
  icon: React.ReactNode
}

const MODAL_TOOLS: ModalTool[] = [
  {
    name: "AgentMail",
    description: "Manage inboxes, send and reply to emails, search threads, and download attachments via AgentMail",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-[#D9F99D] border-2 border-black flex items-center justify-center">
        <svg className="w-6 h-6 text-[#166534]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 8l9 6 9-6" />
        </svg>
      </div>
    )
  },
  {
    name: "Database Memory Service",
    description: "SQL-backed persistent memory for agents",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-[#86EFAC]/20 border-2 border-black flex items-center justify-center">
        <Database className="w-6 h-6 text-blue-600" />
      </div>
    )
  },
  {
    name: "GitHub MCP Server",
    description: "Access context, copilot spaces, actions, security, dependabot, gists, issues, PRs, and repos directly from GitHub.",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-gray-100 border-2 border-black flex items-center justify-center p-1">
        <img
          src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
          alt="GitHub MCP"
          className="w-full h-full object-contain"
        />
      </div>
    )
  },
  {
    name: "Datadog",
    description: "Develop, evaluate, and monitor LLM applications",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-purple-100 border-2 border-black flex items-center justify-center">
        <svg className="w-6 h-6 text-purple-700" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14.5h-2v-2h2v2zm0-4.5h-2V7h2v5z" />
        </svg>
      </div>
    )
  },
  {
    name: "Daytona",
    description: "Execute code, run shell commands, and manage files in secure sandboxes",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center overflow-hidden p-1">
        <img
          src="https://framerusercontent.com/images/eh4XDIID3RQ61pplgsVvLkwrnrk.svg?width=454&height=320"
          alt="Daytona"
          className="w-full h-full object-contain"
        />
      </div>
    )
  },
  {
    name: "DBOS",
    description: "Resilient, scalable, long-running agents with human approvals and safe versioning",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center border-2 border-black">
        <span className="text-[10px] font-black text-white leading-none">DBOS</span>
      </div>
    )
  },
  {
    name: "e2a",
    description: "Authenticated email gateway for AI agents with human-in-the-loop approval",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center border-2 border-black">
        <span className="text-xs font-black text-white leading-none">e2a</span>
      </div>
    )
  },
  {
    name: "ElevenLabs",
    description: "Generate speech, clone voices, transcribe audio, and create sound effects",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-[#FFF4E2] border-2 border-black flex items-center justify-center">
        <div className="flex gap-0.5">
          <div className="w-1.5 h-5 bg-black rounded-full" />
          <div className="w-1.5 h-5 bg-black rounded-full" />
        </div>
      </div>
    )
  },
  {
    name: "Notion",
    description: "Search across your Notion workspace, create pages, and manage databases natively",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center">
        <span className="text-xl font-bold text-black font-serif">N</span>
      </div>
    )
  },
  {
    name: "Postman",
    description: "Connect to Postman ecosystem to manage collections, APIs, and workflows",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-[#FF6C37] border-2 border-black flex items-center justify-center">
        <span className="text-xl font-bold text-white font-sans">P</span>
      </div>
    )
  },
  {
    name: "Environment Toolset",
    description: "Create local and custom compute environments for files, scripts, and code execution",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-[#FFE8B1] border-2 border-black flex items-center justify-center p-1">
        <svg className="w-7 h-7 text-[#FF7A00]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M21 9H3M9 21V9" />
        </svg>
      </div>
    )
  },
  {
    name: "Agent Platform Express Mode",
    description: "Try development with Agent Platform services at no cost",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-[#5CC8FF]/20 border-2 border-black flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-[#5CC8FF]" />
      </div>
    )
  },
  {
    name: "Firestore Session Service",
    description: "Session state management for ADK agents using Firestore",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center p-1">
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
          <path d="M18.5 7.5L12 2L5.5 7.5L12 13L18.5 7.5Z" fill="#FFC107" />
          <path d="M12 13L5.5 7.5V16.5L12 22L18.5 16.5V7.5L12 13Z" fill="#FF9800" />
        </svg>
      </div>
    )
  },
  {
    name: "Freeplay",
    description: "Use Freeplay to build, optimize, and evaluate AI agents with end-to-end observability",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-[#C4B5FD]/20 border-2 border-black flex items-center justify-center p-1">
        <svg className="w-7 h-7 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="7" r="4" />
          <circle cx="7" cy="16" r="4" />
          <circle cx="17" cy="16" r="4" />
        </svg>
      </div>
    )
  },
  {
    name: "Future AGI",
    description: "Trace, evaluate, and improve ADK agents with the traceAI OpenTelemetry integration",
    icon: (
      <div className="w-10 h-10 rounded-lg bg-gray-100 border-2 border-black flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-gray-400" />
      </div>
    )
  }
]

export default function CreateAgentPage() {
  const [description, setDescription] = useState("")
  const [agentName, setAgentName] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null)
  const [memoryMode, setMemoryMode] = useState("session")
  const [responseLength, setResponseLength] = useState("medium")
  const [safetyFilters, setSafetyFilters] = useState(true)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [isMoreModalOpen, setIsMoreModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState("Gynecologist")
  const [customDomain, setCustomDomain] = useState("")
  const [isAddingCustomDomain, setIsAddingCustomDomain] = useState(false)
  const [isStrictModeDropdownOpen, setIsStrictModeDropdownOpen] = useState(false)

  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()

  const DOMAINS = ["Coding Assistant", "Data Science", "Gynecologist", "Math Tutor", "Web Agent"]

  // Progressive loading effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isGenerating) {
      setCurrentStep(0)
      interval = setInterval(() => {
        setCurrentStep((prev) => (prev < FORGE_STEPS.length - 1 ? prev + 1 : prev))
      }, 800)
    }
    return () => clearInterval(interval)
  }, [isGenerating])

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="h-screen bg-[#FDF3B1] flex items-center justify-center">
        <div className="text-2xl font-black">Loading...</div>
      </div>
    )
  }

  // Don't render if no user
  if (!user) {
    return null
  }

  const handleForgeAgent = async () => {
    if (!description.trim()) return
    setIsGenerating(true)
    setSaveError("")

    // Consolidate the domain to use
    const domainToUse = isAddingCustomDomain ? customDomain : selectedDomain;

    try {
      const response = await fetch('/api/forge-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: description,
          domain: domainToUse
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setAgentConfig(data)
        if (data.memory) {
          setMemoryMode(data.memory)
        }
        // Set agent name from input or use generated name
        if (agentName) {
          setAgentConfig(prev => prev ? { ...prev, agentName } : data)
        }
      } else {
        setSaveError(data.error || 'Failed to generate agent configuration. Please try again.')
      }
    } catch (error) {
      setSaveError('Failed to generate agent configuration. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveAgent = async () => {
    if (!agentConfig) return

    setIsSaving(true)
    setSaveError("")
    setSaveSuccess(false)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: agentName || agentConfig.agentName || agentConfig.domain + " Agent",
          description: description,
          systemPrompt: agentConfig.systemPrompt,
          tone: agentConfig.tone,
          domain: agentConfig.domain,
          responseStyle: agentConfig.responseStyle,
          guardrails: agentConfig.guardrails,
          tools: selectedTools,
          memoryMode,
          responseLength,
          safetyFilters
        })
      })

      const data = await response.json()

      if (response.ok) {
        setIsSaved(true)
        setSaveSuccess(true)
        // Auto-hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        setSaveError(data.error || 'Failed to save agent')
      }
    } catch (error) {
      setSaveError('Network error. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleNavigateWithConfig = (path: string) => {
    if (agentConfig) {
      localStorage.setItem('personaforge_pending_config', JSON.stringify({
        name: agentConfig.agentName || agentConfig.domain + " Agent",
        tone: agentConfig.tone,
        expertise: agentConfig.domain,
        description: agentConfig.systemPrompt,
        guardrails: safetyFilters ? agentConfig.guardrails : [],
        tools: selectedTools
      }))
    }
    router.push(path)
  }

  return (
    <div className="min-h-screen bg-[#FDF3B1]">
      <header className="bg-[#FFF4E2] border-b-[3px] border-black p-4 sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </a>
            <h1 className="text-2xl font-black">Create AI Agent</h1>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FF7A00]" />
            <span className="font-black">PersonaForge Studio</span>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto p-6">
        <div className="grid lg:grid-cols-[400px_1fr_350px] gap-6">
          <div className="space-y-6">
            <Card>
              <h2 className="text-2xl font-black mb-2">Describe Your AI Agent</h2>
              <p className="text-sm text-gray-600 mb-4">Use natural language to describe what kind of AI agent you want to create.</p>

              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Agent Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., Startup Mentor AI"
                  className="w-full px-4 py-3 text-base border-[3px] border-black rounded-lg bg-white focus:outline-none focus:ring-4 focus:ring-[#FF7A00]/30 transition-all font-medium"
                />
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Example: Create a friendly AI startup mentor that helps founders validate ideas and provides practical business advice."
                className="w-full h-48 px-4 py-3 text-base border-[3px] border-black rounded-lg bg-white focus:outline-none focus:ring-4 focus:ring-[#FF7A00]/30 transition-all resize-none font-medium"
              />
              <Button size="lg" className="w-full mt-4" onClick={handleForgeAgent} disabled={!description.trim() || isGenerating}>
                <Sparkles className="w-5 h-5 mr-2" />
                {isGenerating ? "Forging..." : "Forge Agent"}
              </Button>
            </Card>
            <div>
              <h3 className="text-lg font-black mb-3">Suggested Prompts</h3>
              <div className="space-y-3">
                {[
                  { title: "Startup Mentor AI", description: "Create a friendly AI startup mentor that helps founders validate ideas and provides practical business advice.", color: "#5CC8FF" },
                  { title: "Customer Support AI", description: "Build an AI agent that handles customer inquiries professionally and resolves common support tickets.", color: "#86EFAC" },
                  { title: "Python Tutor", description: "Design an AI coding tutor that teaches Python programming concepts with clear examples and exercises.", color: "#FF9AA2" },
                  { title: "Resume Reviewer", description: "Create an AI that reviews resumes and provides constructive feedback on formatting, content, and impact.", color: "#C4B5FD" }
                ].map((prompt, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setDescription(prompt.description)}
                    className="w-full p-4 border-[3px] border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] transition-all text-left"
                    style={{ backgroundColor: prompt.color }}
                  >
                    <div className="font-black mb-1">{prompt.title}</div>
                    <div className="text-sm">{prompt.description}</div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="bg-[#FFE8B1]">
              <h2 className="text-2xl font-black mb-6">Generated Agent Configuration</h2>
              <AnimatePresence mode="wait">
                {!agentConfig && !isGenerating && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-[500px] text-center">
                    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="mb-6">
                      <Sparkles className="w-20 h-20 text-gray-400" />
                    </motion.div>
                    <h3 className="text-2xl font-black mb-2 text-gray-700">No Agent Yet</h3>
                    <p className="text-gray-600">Describe your agent and click "Forge Agent" to get started</p>
                  </motion.div>
                )}
                {isGenerating && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-[500px]">
                    <div className="relative mb-12">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="w-24 h-24 text-[#FF7A00]" />
                      </motion.div>
                      <motion.div
                        className="absolute inset-0 flex items-center justify-center"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <div className="w-12 h-12 bg-[#FF7A00]/20 rounded-full blur-xl" />
                      </motion.div>
                    </div>
                    <h3 className="text-3xl font-black mb-6">Forging your AI agent...</h3>
                    <div className="w-full max-w-sm space-y-4">
                      {FORGE_STEPS.map((step, idx) => (
                        <div key={step} className="flex items-center gap-3">
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 border-black flex items-center justify-center transition-colors duration-300",
                            idx < currentStep ? "bg-[#86EFAC]" : idx === currentStep ? "bg-[#FF7A00] animate-pulse" : "bg-white"
                          )}>
                            {idx < currentStep && <div className="w-2 h-2 bg-black rounded-full" />}
                          </div>
                          <span className={cn(
                            "font-bold transition-opacity duration-300",
                            idx <= currentStep ? "opacity-100" : "opacity-30"
                          )}>
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                {agentConfig && !isGenerating && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-[#FF7A00] border-[3px] border-black rounded-lg col-span-2 text-white">
                        <div className="text-xs font-bold mb-1 opacity-80 uppercase">Agent Name</div>
                        <div className="text-2xl font-black">{agentConfig.agentName}</div>
                      </div>
                      <div className="p-4 bg-[#5CC8FF] border-[3px] border-black rounded-lg">
                        <div className="text-xs font-bold mb-1 opacity-80 uppercase">Tone / Personality</div>
                        <div className="font-black">{agentConfig.tone}</div>
                      </div>
                      <div className="p-4 bg-[#86EFAC] border-[3px] border-black rounded-lg">
                        <div className="text-xs font-bold mb-1 opacity-80 uppercase">Domain Expertise</div>
                        <div className="font-black">{agentConfig.domain}</div>
                      </div>
                      <div className="p-4 bg-[#FF9AA2] border-[3px] border-black rounded-lg col-span-2">
                        <div className="text-xs font-bold mb-1 opacity-80 uppercase">Response Style</div>
                        <div className="font-black">{agentConfig.responseStyle}</div>
                      </div>
                    </div>
                    <div className="p-4 bg-[#C4B5FD] border-[3px] border-black rounded-lg">
                      <div className="text-xs font-bold mb-2 opacity-80 uppercase">Guardrails</div>
                      <div className="flex flex-wrap gap-2">
                        {agentConfig.guardrails.map((guardrail, index) => (
                          <span key={index} className="px-3 py-1 bg-white border-[2px] border-black rounded-lg text-sm font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{guardrail}</span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Strict Mode Modal/Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-[3px] border-black rounded-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-6 h-6 text-[#FF7A00]" />
                  <h2 className="text-xl font-black">Strict Mode</h2>
                </div>
                <div className="px-2 py-1 bg-[#FF7A00] text-white text-[10px] font-black rounded uppercase">Manual Override</div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">Select Domain Expertise</label>
                  <div className="relative">
                    <button
                      onClick={() => setIsStrictModeDropdownOpen(!isStrictModeDropdownOpen)}
                      className="w-full flex items-center justify-between px-4 py-3 text-base border-[3px] border-black rounded-lg bg-white focus:outline-none focus:ring-4 focus:ring-[#FF7A00]/30 transition-all font-bold cursor-pointer"
                    >
                      <span>{isAddingCustomDomain ? "Custom Domain" : selectedDomain}</span>
                      <svg className={cn("w-4 h-4 transition-transform", isStrictModeDropdownOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <AnimatePresence>
                      {isStrictModeDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute left-0 right-0 mt-2 bg-[#FFF4E2] border-[3px] border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2 z-50 max-h-60 overflow-y-auto"
                        >
                          <button
                            onClick={() => {
                              setIsAddingCustomDomain(true)
                              setIsStrictModeDropdownOpen(false)
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 mb-1 rounded-md font-bold text-sm text-[#FF7A00] hover:bg-[#FDF3B1] transition-colors border-b-2 border-black/5 pb-3 flex items-center gap-3"
                            )}
                          >
                            <Plus className="w-5 h-5" />
                            + Create New Domain...
                          </button>
                          <div className="font-bold text-xs text-gray-500 uppercase px-3 pt-2 pb-1">Available Domains</div>
                          {DOMAINS.map(domain => (
                            <button
                              key={domain}
                              onClick={() => {
                                setIsAddingCustomDomain(false)
                                setSelectedDomain(domain)
                                setIsStrictModeDropdownOpen(false)
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-md font-bold text-sm hover:bg-[#FDF3B1] transition-colors flex items-center gap-3",
                                !isAddingCustomDomain && selectedDomain === domain && "bg-[#FDF3B1]"
                              )}
                            >
                              <Sparkles className="w-5 h-5 text-[#FF7A00]" />
                              {domain}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <AnimatePresence>
                  {isAddingCustomDomain && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <label className="block text-sm font-bold mb-2">New Domain Name</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customDomain}
                          onChange={(e) => setCustomDomain(e.target.value)}
                          placeholder="e.g., Quantum Physics Expert"
                          className="flex-1 px-4 py-2 text-sm border-[3px] border-black rounded-lg bg-white focus:outline-none focus:ring-4 focus:ring-[#FF7A00]/30 transition-all font-medium"
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            if (customDomain.trim()) {
                              setSelectedDomain(customDomain.trim())
                              setIsAddingCustomDomain(false)
                              setCustomDomain("")
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="text-xs text-gray-500 font-bold italic">
                  * Strict Mode ensures the agent remains strictly within its designated domain.
                </p>
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <Card>
              <h2 className="text-xl font-black mb-4">Agent Settings</h2>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4" />
                  <h3 className="text-sm font-black">Memory Mode</h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {["stateless", "session", "persistent"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setMemoryMode(mode)}
                      className={cn(
                        "w-full p-2.5 border-[3px] border-black rounded-lg font-bold text-left transition-all",
                        memoryMode === mode
                          ? "bg-[#FF7A00] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-[#FFF4E2] hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      )}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4" />
                  <h3 className="text-sm font-black">Response Length</h3>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["short", "medium", "long"].map((length) => (
                    <button
                      key={length}
                      onClick={() => setResponseLength(length)}
                      className={cn(
                        "p-2 border-[3px] border-black rounded-lg font-bold text-center text-xs transition-all",
                        responseLength === length
                          ? "bg-[#FF7A00] text-white"
                          : "bg-[#FFF4E2] hover:bg-white"
                      )}
                    >
                      {length.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4" />
                  <h3 className="text-sm font-black">Guardrails</h3>
                </div>
                <button onClick={() => setSafetyFilters(!safetyFilters)} className={cn("w-full p-3 border-[3px] border-black rounded-lg font-bold flex items-center justify-between transition-all", safetyFilters ? "bg-[#86EFAC]" : "bg-[#FFF4E2]")}>
                  <span className="text-sm text-black">Safety Filters</span>
                  <div className={cn("w-10 h-5 rounded-full border-[2px] border-black relative transition-all", safetyFilters ? "bg-[#FF7A00]" : "bg-gray-300")}>
                    <div className={cn("absolute top-0.5 w-3 h-3 bg-white border-[2px] border-black rounded-full transition-all", safetyFilters ? "right-0.5" : "left-0.5")} />
                  </div>
                </button>
              </div>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4" />
                  <h3 className="text-sm font-black">Integration</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { name: "Read File", icon: <FileText className="w-5 h-5 text-gray-600" /> },
                    { name: "Gmail", icon: "https://download.logo.wine/logo/Gmail/Gmail-Logo.wine.png" },
                    { name: "Daytona", icon: "https://framerusercontent.com/images/eh4XDIID3RQ61pplgsVvLkwrnrk.svg?width=454&height=320" },
                    { name: "GitHub MCP Server", icon: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" }
                  ].map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => {
                        if (selectedTools.includes(tool.name)) {
                          setSelectedTools(selectedTools.filter(t => t !== tool.name))
                        } else {
                          setSelectedTools([...selectedTools, tool.name])
                        }
                      }}
                      className={cn(
                        "w-full p-3 border-[3px] border-black rounded-lg font-bold flex items-center justify-between transition-all",
                        selectedTools.includes(tool.name) ? "bg-[#FFD84D]" : "bg-white hover:bg-gray-100"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {tool.icon && (
                          typeof tool.icon === 'string' ? (
                            <img src={tool.icon} alt={tool.name} className="w-5 h-5 object-contain" />
                          ) : (
                            tool.icon
                          )
                        )}
                        <span className="text-sm text-black">{tool.name}</span>
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-md border-[2px] border-black flex items-center justify-center transition-all",
                        selectedTools.includes(tool.name) ? "bg-black" : "bg-white"
                      )}>
                        {selectedTools.includes(tool.name) && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIsMoreModalOpen(true)}
                    className="w-full p-3 border-[3px] border-black rounded-lg font-bold flex items-center justify-between transition-all bg-[#FF7A00] text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <span className="text-sm">+ More Options</span>
                    <span className="text-xs font-bold">View All</span>
                  </button>

                  {selectedTools.filter(t => !["Google Search", "Read File", "Gmail", "Daytona", "GitHub MCP Server"].includes(t)).length > 0 && (
                    <div className="mt-3 pt-3 border-t-2 border-black/10">
                      <div className="text-xs font-bold text-gray-500 mb-2 uppercase">Extra Active Integrations</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTools
                          .filter(t => !["Google Search", "Read File", "Gmail", "Daytona", "GitHub MCP Server"].includes(t))
                          .map(toolName => (
                            <span
                              key={toolName}
                              className="px-2.5 py-1 bg-[#86EFAC] border-[2px] border-black rounded-lg text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
                            >
                              <span>{toolName}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedTools(selectedTools.filter(t => t !== toolName))}
                                className="hover:bg-black/10 rounded-full p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            <Card className="bg-[#5CC8FF]">
              <h3 className="text-lg font-black mb-4">Actions</h3>

              {saveSuccess && (
                <div className="p-3 bg-[#86EFAC] border-[3px] border-black rounded-lg mb-4 shadow-[4px_4px_0px_0px_rgba(34,197,94,1)] animate-pulse">
                  <p className="text-black font-bold text-sm flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Agent saved successfully!
                  </p>
                </div>
              )}

              {saveError && (
                <div className="p-3 bg-white border-[3px] border-red-500 rounded-lg mb-4 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
                  <p className="text-red-600 font-bold text-xs">{saveError}</p>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  variant="outline"
                  className={cn(
                    "w-full bg-white",
                    !isSaved && "cursor-not-allowed opacity-50"
                  )}
                  disabled={!agentConfig || !isSaved}
                  onClick={() => handleNavigateWithConfig('/sandbox')}
                  title={!isSaved ? "Please save the agent first" : "Test in Sandbox"}
                >
                  <TestTube className="w-4 h-4 mr-2" />
                  Test in Sandbox
                </Button>
                <Button
                  variant="outline"
                  className="w-full bg-white"
                  disabled={!agentConfig || isSaving}
                  onClick={handleSaveAgent}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : isSaved ? "Saved ✓" : "Save Agent"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* More Tools Modal */}
      <AnimatePresence>
        {isMoreModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#FFF4E2] border-[3px] border-black p-6 md:p-8 rounded-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-5xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-black">More Tools & Integrations</h2>
                  <p className="text-sm text-gray-600 mt-1">Select and integrate advanced capabilities for your AI agent.</p>
                </div>
                <button
                  onClick={() => {
                    setIsMoreModalOpen(false)
                    setSearchQuery("")
                  }}
                  className="bg-white border-[2px] border-black rounded-lg p-1.5 hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search tools and integrations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 text-base border-[3px] border-black rounded-lg bg-white focus:outline-none focus:ring-4 focus:ring-[#FF7A00]/30 transition-all font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                />
              </div>

              {/* Tools Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODAL_TOOLS.filter(tool =>
                  tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  tool.description.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((tool) => {
                  const isSelected = selectedTools.includes(tool.name)
                  return (
                    <button
                      key={tool.name}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTools(selectedTools.filter(t => t !== tool.name))
                        } else {
                          setSelectedTools([...selectedTools, tool.name])
                        }
                      }}
                      className={cn(
                        "p-4 border-[3px] border-black rounded-xl text-left flex items-start gap-4 transition-all duration-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                        isSelected ? "bg-[#FFD84D]" : "bg-white hover:bg-gray-100"
                      )}
                    >
                      <div className="flex-shrink-0">{tool.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-base text-black truncate">{tool.name}</span>
                          <div className={cn(
                            "w-5 h-5 rounded-md border-[2px] border-black flex items-center justify-center flex-shrink-0 transition-all",
                            isSelected ? "bg-black" : "bg-white"
                          )}>
                            {isSelected && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-700 mt-1.5 leading-normal font-bold">{tool.description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="mt-8 pt-6 border-t-3 border-black flex justify-between items-center">
                <div className="text-sm font-black text-black">
                  {selectedTools.length} tool{selectedTools.length !== 1 ? 's' : ''} selected
                </div>
                <Button
                  onClick={() => {
                    setIsMoreModalOpen(false)
                    setSearchQuery("")
                  }}
                  size="sm"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

