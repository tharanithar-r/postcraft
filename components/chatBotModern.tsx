"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Plus, Trash2, Send, Search, Menu, LogOut, User as UserIcon, ChevronDown, Check, X as XIcon, Loader2, RefreshCw, CheckCircle, Mic } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import toast, { Toaster } from "react-hot-toast"
import { checkAndRefreshAllPlatforms } from "@/lib/token-refresh"
import { Input, Button, Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Divider, Card, CardBody, Textarea, Select, SelectItem } from "@heroui/react"

const useTypewriter = (text: string, speed: number = 25, startTyping: boolean = true) => {
    const [displayedText, setDisplayedText] = useState("")
    const [isComplete, setIsComplete] = useState(false)

    useEffect(() => {
        if (!startTyping) {
            setDisplayedText("")
            setIsComplete(false)
            return
        }

        if (!text) {
            setIsComplete(true)
            return
        }

        let index = 0
        setDisplayedText("")
        setIsComplete(false)

        const timer = setInterval(() => {
            if (index < text.length) {
                setDisplayedText(text.slice(0, index + 1))
                index++
            } else {
                setIsComplete(true)
                clearInterval(timer)
            }
        }, speed)

        return () => clearInterval(timer)
    }, [text, speed, startTyping])

    return { displayedText, isComplete }
}

// Typewriter Text Component
const TypewriterText = ({ text, speed = 25, onComplete }: { text: string; speed?: number; onComplete?: () => void }) => {
    const { displayedText, isComplete } = useTypewriter(text, speed, true)
    const hasCalledComplete = useRef(false)

    useEffect(() => {
        if (isComplete && onComplete && !hasCalledComplete.current) {
            hasCalledComplete.current = true
            onComplete()
        }
    }, [isComplete, onComplete])

    return (
        <span>
            {displayedText}
            {!isComplete && <span className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5">|</span>}
        </span>
    )
}

// Reusable Chat Input Area Component
const ChatInputArea = ({
    input,
    setInput,
    isLoading,
    sendMessage,
    selectedPlatforms,
    setSelectedPlatforms,
    connectedPlatforms,
    platformColors,
    platformIcons,
    mounted
}: {
    input: string;
    setInput: (value: string) => void;
    isLoading: boolean;
    sendMessage: () => void;
    selectedPlatforms: string[];
    setSelectedPlatforms: (platforms: string[]) => void;
    connectedPlatforms: any[];
    platformColors: { [key: string]: string };
    platformIcons: { [key: string]: string };
    mounted: boolean;
}) => {
    if (!mounted) return null;

    return (
        <div className="relative">
            <Textarea
                placeholder="Describe your post..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                        e.preventDefault()
                        sendMessage()
                    }
                }}
                minRows={3}
                maxRows={8}
                variant="flat"
                classNames={{
                    input: "text-white font-light px-2 pt-3",
                    inputWrapper: "bg-gray-800/40 data-[hover=true]:bg-gray-800/60 pb-12"
                }}
            />

            {/* Bottom Controls - Positioned inside textarea */}
            <div className="absolute bottom-2 left-2 right-2 px-2 flex items-center justify-between">
                {/* Platform Selector - Bottom Left */}
                <Select
                    aria-label="Select platforms"
                    placeholder="Platforms"
                    selectionMode="multiple"
                    selectedKeys={new Set(selectedPlatforms)}
                    onSelectionChange={(keys) => {
                        setSelectedPlatforms(Array.from(keys as Set<string>))
                    }}
                    variant="bordered"
                    color="success"
                    size="md"
                    classNames={{
                        base: ` ${selectedPlatforms.length > 0 ? "w-auto min-w-[120px]" : "w-auto min-w-[100px]"}`,
                        trigger: "h-8 min-h-unit-8 px-2 gap-1",
                        value: "text-sm",
                        innerWrapper: "gap-1"
                    }}
                    popoverProps={{
                        classNames: {
                            content: "min-w-[280px]"
                        }
                    }}
                    renderValue={(items) => {
                        if (items.length === 0) {
                            return <span className="text-gray-400 text-sm">Platforms</span>
                        }
                        return (
                            <div className="flex gap-1 items-center">
                                {items.map((item) => {
                                    const platform = item.key as string
                                    return (
                                        <div
                                            key={platform}
                                            className={`w-5 h-5 ${platformColors[platform]} rounded flex items-center justify-center p-0.5`}
                                        >
                                            {platformIcons[platform] ? (
                                                <img src={platformIcons[platform]} alt={platform} className="w-full h-full object-contain" />
                                            ) : (
                                                <span className="text-white text-xs font-bold">{platform.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    }}
                >
                    {connectedPlatforms.map((account) => (
                        <SelectItem
                            key={account.platform.toLowerCase()}
                            startContent={
                                <div className={`w-6 h-6 ${platformColors[account.platform.toLowerCase()]} rounded flex items-center justify-center p-1`}>
                                    {platformIcons[account.platform.toLowerCase()] ? (
                                        <img src={platformIcons[account.platform.toLowerCase()]} alt={account.platform} className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-white text-xs font-bold">{account.platform.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                            }
                            endContent={
                                <div>{account.account_username ? `@${account.account_username}` : undefined}</div>
                            }
                        >
                            {account.platform}
                        </SelectItem>
                    ))}
                </Select>

                {/* Send Button - Bottom Right */}
                <Button
                    onPress={sendMessage}
                    isLoading={isLoading}
                    color="success"
                    size="md"
                    isDisabled={!input.trim() || selectedPlatforms.length === 0}
                    startContent={!isLoading && <Send className="w-4 h-4" />}
                    className="h-8"
                >
                    {isLoading ? "Sending..." : "Send"}
                </Button>
            </div>
        </div>
    )
}

// Track typing completion for posts
const PostWithTypewriter = ({
    post,
    platformColors,
    platformIcons,
    onAllComplete
}: {
    post: any;
    platformColors: any;
    platformIcons: any;
    onAllComplete: () => void;
}) => {
    const [textComplete, setTextComplete] = useState(false)
    const [hashtagsComplete, setHashtagsComplete] = useState(false)
    const totalHashtags = post.hashtags?.length || 0
    const [completedHashtags, setCompletedHashtags] = useState(0)

    useEffect(() => {
        if (textComplete && (totalHashtags === 0 || hashtagsComplete)) {
            onAllComplete()
        }
    }, [textComplete, hashtagsComplete, totalHashtags, onAllComplete])

    useEffect(() => {
        if (completedHashtags === totalHashtags && totalHashtags > 0) {
            setHashtagsComplete(true)
        }
    }, [completedHashtags, totalHashtags])

    return (
        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 ${platformColors[post.platform.toLowerCase()] || 'bg-slate-600'} rounded flex items-center justify-center p-1`}>
                    {platformIcons[post.platform.toLowerCase()] ? (
                        <img src={platformIcons[post.platform.toLowerCase()]} alt={post.platform} className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-white text-xs font-bold">{post.platform.charAt(0).toUpperCase()}</span>
                    )}
                </div>
                <span className="text-sm font-semibold capitalize text-gray-300">{post.platform}</span>
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap">
                <TypewriterText text={post.post_text} speed={25} onComplete={() => setTextComplete(true)} />
            </p>
            {post.hashtags && post.hashtags.length > 0 && textComplete && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {post.hashtags.map((tag: string, i: number) => (
                        <span key={i} className="text-xs text-emerald-400">
                            <TypewriterText
                                text={tag.startsWith('#') ? tag : `#${tag}`}
                                speed={25}
                                onComplete={() => setCompletedHashtags(prev => prev + 1)}
                            />
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

interface Message {
    role: "user" | "assistant"
    content: string
    postData?: GeneratedPost
    error?: boolean
}

interface Chat {
    id: string
    title: string
    messages: Message[]
    createdAt: Date
}

interface SocialAccount {
    id: string
    platform: string
    account_username: string | null
}

interface GeneratedPost {
    success: boolean
    userId: string
    postId: string
    generated_content: {
        posts?: Array<{
            platform: string
            post_text: string
            hashtags: string[]
        }>
        image_description?: string
        image_url?: string
    }
    image_url?: string
}

export default function ChatBotModern() {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [chats, setChats] = useState<Chat[]>([])
    const [currentChatId, setCurrentChatId] = useState<string | null>(null)
    const [input, setInput] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const [userName, setUserName] = useState<string>("")
    const [userEmail, setUserEmail] = useState<string>("")
    const [connectedPlatforms, setConnectedPlatforms] = useState<SocialAccount[]>([])
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
    const [isApproving, setIsApproving] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [typingMessageIds, setTypingMessageIds] = useState<Set<number>>(new Set())
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true)
    }, [])

    const currentChat = chats.find((c) => c.id === currentChatId)

    const platformIcons: { [key: string]: string } = {
        x: "/X.svg",
        linkedin: "/linkedin.svg",
        facebook: "/facebook.svg",
        discord: "/discord.svg",
        telegram: "/telegram.svg"
    }

    const platformColors: { [key: string]: string } = {
        x: "bg-white",
        linkedin: "bg-blue-600",
        facebook: "bg-blue-500",
        discord: "bg-indigo-500",
        telegram: "bg-blue-400"
    }

    const getGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return "Good Morning"
        if (hour < 18) return "Good Afternoon"
        return "Good Evening"
    }

    const groupChatsByDate = () => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const lastWeek = new Date(today)
        lastWeek.setDate(lastWeek.getDate() - 7)

        const groups: { [key: string]: Chat[] } = {
            Today: [],
            Yesterday: [],
            "Last 7 Days": [],
            Older: []
        }

        chats.forEach(chat => {
            const chatDate = new Date(chat.createdAt)
            const chatDay = new Date(chatDate.getFullYear(), chatDate.getMonth(), chatDate.getDate())

            if (chatDay.getTime() === today.getTime()) {
                groups.Today.push(chat)
            } else if (chatDay.getTime() === yesterday.getTime()) {
                groups.Yesterday.push(chat)
            } else if (chatDate >= lastWeek) {
                groups["Last 7 Days"].push(chat)
            } else {
                groups.Older.push(chat)
            }
        })

        return groups
    }

    const filteredChats = chats.filter(chat =>
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const newChat = () => {
        const id = Date.now().toString()
        const chat: Chat = { id, title: "New Chat", messages: [], createdAt: new Date() }
        setChats([chat, ...chats])
        setCurrentChatId(id)
    }

    const deleteChat = (id: string) => {
        setChats(chats.filter((c) => c.id !== id))
        if (currentChatId === id) {
            setCurrentChatId(chats[0]?.id || null)
        }
    }

    const handleLogout = async () => {
        try {
            const supabase = createClient()
            await supabase.auth.signOut()
            toast.success("Logged out successfully")
            router.push("/login")
        } catch (error) {
            toast.error("Failed to logout")
        }
    }

    useEffect(() => {
        async function fetchUserData() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                setUserId(user.id)
                setUserName(user.user_metadata?.name || user.email?.split('@')[0] || 'User')
                setUserEmail(user.email || '')

                const { data: platforms } = await supabase
                    .from('social_accounts')
                    .select('*')
                    .eq('user_id', user.id)

                if (platforms) {
                    setConnectedPlatforms(platforms)
                }
            }
        }
        fetchUserData()
    }, [])

    const sendMessage = async () => {
        if (!input.trim() || !currentChatId || !userId || selectedPlatforms.length === 0) {
            if (selectedPlatforms.length === 0) {
                toast.error("Please select at least one platform")
            }
            return
        }

        const userMessage: Message = { role: "user", content: input }

        const updatedChats = chats.map((chat) => {
            if (chat.id === currentChatId) {
                return {
                    ...chat,
                    title: chat.title === "New Chat" ? input.slice(0, 30) : chat.title,
                    messages: [...chat.messages, userMessage],
                }
            }
            return chat
        })
        setChats(updatedChats)
        setInput("")
        setIsLoading(true)

        try {
            const refreshResults = await checkAndRefreshAllPlatforms(userId, selectedPlatforms)

            const failedPlatforms = Object.entries(refreshResults)
                .filter(([_, result]) => !result.success)
                .map(([platform, result]) => ({
                    platform,
                    needsReconnect: result.needsReconnect,
                    error: result.error
                }))

            if (failedPlatforms.length > 0) {
                const reconnectNeeded = failedPlatforms.filter(p => p.needsReconnect)

                if (reconnectNeeded.length > 0) {
                    const platformNames = reconnectNeeded.map(p => p.platform.toUpperCase()).join(', ')
                    toast.error(`Please reconnect your ${platformNames} account(s) in your profile`)

                    const errorMessage: Message = {
                        role: "assistant",
                        content: `Unable to generate post. Your ${platformNames} token(s) have expired. Please visit your profile to reconnect.`,
                        error: true,
                    }

                    setChats(prevChats => prevChats.map((chat) => {
                        if (chat.id === currentChatId) {
                            return {
                                ...chat,
                                messages: [...chat.messages, errorMessage],
                            }
                        }
                        return chat
                    }))

                    setIsLoading(false)
                    return
                }
            }

            const response = await fetch('http://localhost:5678/webhook/generate-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    prompt: input,
                    platforms: selectedPlatforms,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to generate post')
            }

            const data = await response.json()

            const postData: GeneratedPost = {
                success: data.success || true,
                userId: data.userId || userId!,
                postId: data.postId,
                generated_content: data.generated_content || {},
                image_url: data.image_url || data.generated_content?.image_url || '',
            }

            const assistantMessage: Message = {
                role: "assistant",
                content: "Here's your generated post:",
                postData: postData,
            }

            setChats(prevChats => prevChats.map((chat) => {
                if (chat.id === currentChatId) {
                    return {
                        ...chat,
                        messages: [...chat.messages, assistantMessage],
                    }
                }
                return chat
            }))

        } catch (error) {
            console.error('Error generating post:', error)

            const errorMessage: Message = {
                role: "assistant",
                content: "Sorry, I couldn't generate the post. Please try again.",
                error: true,
            }

            setChats(prevChats => prevChats.map((chat) => {
                if (chat.id === currentChatId) {
                    return {
                        ...chat,
                        messages: [...chat.messages, errorMessage],
                    }
                }
                return chat
            }))

            toast.error("Failed to generate post")
        } finally {
            setIsLoading(false)
        }
    }

    const handleApprove = async (postId: string) => {
        if (!userId) return

        setIsApproving(true)

        try {
            const refreshResults = await checkAndRefreshAllPlatforms(userId, selectedPlatforms)

            const failedPlatforms = Object.entries(refreshResults)
                .filter(([_, result]) => !result.success)
                .map(([platform, result]) => ({
                    platform,
                    needsReconnect: result.needsReconnect,
                    error: result.error
                }))

            if (failedPlatforms.length > 0) {
                const reconnectNeeded = failedPlatforms.filter(p => p.needsReconnect)

                if (reconnectNeeded.length > 0) {
                    const platformNames = reconnectNeeded.map(p => p.platform.toUpperCase()).join(', ')
                    toast.error(`Please reconnect your ${platformNames} account(s) in your profile`)

                    const errorMessage: Message = {
                        role: "assistant",
                        content: `Unable to publish post. Your ${platformNames} token(s) have expired. Please visit your profile to reconnect.`,
                        error: true,
                    }

                    setChats(prevChats => prevChats.map((chat) => {
                        if (chat.id === currentChatId) {
                            return {
                                ...chat,
                                messages: [...chat.messages, errorMessage],
                            }
                        }
                        return chat
                    }))

                    setIsApproving(false)
                    return
                }
            }

            const response = await fetch('http://localhost:5678/webhook/approve-post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    postId,
                    action: 'approve',
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to approve post')
            }

            const result = await response.json()

            let platformsStatus: Record<string, string> = {}
            try {
                platformsStatus = typeof result.platforms === 'string'
                    ? JSON.parse(result.platforms)
                    : result.platforms
            } catch (e) {
                console.error('Failed to parse platforms status:', e)
            }

            const successPlatforms = Object.entries(platformsStatus)
                .filter(([_, status]) => status === 'success')
                .map(([platform]) => platform.toUpperCase())

            const failedPlatformsList = Object.entries(platformsStatus)
                .filter(([_, status]) => status !== 'success')
                .map(([platform, status]) => ({ platform: platform.toUpperCase(), status }))

            let statusMessage = ''
            let isError = false

            if (result.overallStatus === 'published' && successPlatforms.length > 0) {
                const postplatformlist = successPlatforms.join(', ')
                statusMessage = `Post published successfully to ${postplatformlist}!`
                toast.success(`Published to ${postplatformlist}!`)
            } else if (result.overallStatus === 'partial') {
                const successList = successPlatforms.join(', ')
                const failedList = failedPlatformsList.map(p => p.platform).join(', ')
                statusMessage = `Post published to ${successList}. Failed to publish to ${failedList}.`
                toast.error(`Failed to publish to ${failedList}`)
                isError = true
            } else {
                const failedList = failedPlatformsList.map(p => p.platform).join(', ')
                statusMessage = `Failed to publish post to ${failedList}.`
                toast.error('Failed to publish post')
                isError = true
            }

            const errorDetails = failedPlatformsList
                .filter(p => p.status !== 'failed')
                .map(p => `${p.platform}: ${p.status}`)

            if (errorDetails.length > 0) {
                statusMessage += `\n\nDetails:\n${errorDetails.join('\n')}`
            }

            const statusChatMessage: Message = {
                role: "assistant",
                content: statusMessage,
                error: isError,
            }

            setChats(prevChats => prevChats.map((chat) => {
                if (chat.id === currentChatId) {
                    return {
                        ...chat,
                        messages: [...chat.messages, statusChatMessage],
                    }
                }
                return chat
            }))

        } catch (error) {
            console.error('Error approving post:', error)
            toast.error("Failed to approve post")

            const errorMessage: Message = {
                role: "assistant",
                content: "❌ Failed to approve and publish post. Please try again.",
                error: true,
            }

            setChats(prevChats => prevChats.map((chat) => {
                if (chat.id === currentChatId) {
                    return {
                        ...chat,
                        messages: [...chat.messages, errorMessage],
                    }
                }
                return chat
            }))
        } finally {
            setIsApproving(false)
        }
    }

    const handleRegenerate = (originalPrompt: string) => {
        setInput(originalPrompt)
    }

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [currentChat?.messages])

    useEffect(() => {
        newChat()
    }, [])


    return (
        <div className="flex h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
            <Toaster position="top-center" />

            {/* Image Enlargement Modal */}
            {enlargedImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setEnlargedImage(null)}
                >
                    <div className="relative max-w-4xl max-h-full">
                        <Button
                            isIconOnly
                            variant="light"
                            className="absolute -top-10 right-0 text-white"
                            onPress={() => setEnlargedImage(null)}
                        >
                            <XIcon className="w-6 h-6" />
                        </Button>
                        <img
                            src={enlargedImage}
                            alt="Enlarged preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        />
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 bg-slate-900/50 backdrop-blur-sm border-r border-slate-700 flex flex-col overflow-hidden`}>
                {/* Brand */}
                <div className="p-4 border-b border-slate-700 flex justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-normal text-white tracking-tight">PostCraft</span>
                    </div>
                    <Button
                        isIconOnly
                        variant="light"
                        onPress={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden"
                    >
                        <Menu className="w-5 h-5 text-gray-400" />
                    </Button>
                </div>

                {/* Search */}
                <div className="p-4">
                    {mounted && (
                        <Input
                            placeholder="Search chats"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            startContent={<Search className="w-4 h-4 text-gray-400" />}
                            variant="bordered"
                            size="md"
                            classNames={{
                                input: "text-white font-light",
                                inputWrapper: "border-slate-700 hover:border-slate-600 bg-slate-800/40"
                            }}
                        />
                    )}
                </div>

                {/* New Chat Button */}
                <div className="px-4 pb-4">
                    <Button
                        onPress={newChat}
                        color="success"
                        variant="ghost"
                        startContent={<Plus className="w-4 h-4" />}
                        className="w-full"
                    >
                        New Chat
                    </Button>
                </div>

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto px-4 space-y-4">
                    {Object.entries(groupChatsByDate()).map(([group, groupChats]) => {
                        if (groupChats.length === 0) return null

                        const filtered = groupChats.filter(chat =>
                            chat.title.toLowerCase().includes(searchQuery.toLowerCase())
                        )

                        if (filtered.length === 0) return null

                        return (
                            <div key={group}>
                                <p className="text-xs text-gray-500 mb-2 px-2">{group}</p>
                                <div className="space-y-1">
                                    {filtered.map((chat) => (
                                        <Button
                                            key={chat.id}
                                            variant="flat"
                                            color="success"
                                            fullWidth
                                            onClick={() => setCurrentChatId(chat.id)}
                                        >
                                            <span className="text-sm">{chat.title}</span>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                onPress={() => deleteChat(chat.id)}
                                            >
                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                            </Button>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* User Profile */}
                <div className="p-4 border-t border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                        <Avatar
                            name={userName}
                            size="sm"
                            className="bg-gradient-to-br from-emerald-400 to-teal-500"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                            <p className="text-xs text-gray-400 truncate">{userEmail}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="flat"
                            className="flex-1"
                            startContent={<UserIcon className="w-3.5 h-3.5" />}
                            onPress={() => router.push('/profile')}
                        >
                            Profile
                        </Button>
                        <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            isIconOnly
                            onPress={handleLogout}
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </div>


            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!currentChat || currentChat.messages.length === 0 ? (
                        /* Welcome Screen */
                        <div className="flex flex-col items-center justify-center h-full max-w-3xl mx-auto">
                            {/* Glass Icon */}
                            <div className="relative mb-8">
                                <img
                                    src="/glass_3d.png"
                                    alt="Glass Icon"
                                    className="w-32 h-32 object-contain"
                                />
                            </div>

                            {/* Greeting */}
                            <h1 className="text-4xl font-normal text-white mb-3 tracking-tight">
                                {getGreeting()}, {userName}.
                            </h1>
                            <p className="text-lg text-gray-400 mb-12 text-center max-w-2xl font-light">
                                Can I help you with anything?
                            </p>

                            {/* Input Area */}
                            <div className="w-full max-w-2xl">
                                <ChatInputArea
                                    input={input}
                                    setInput={setInput}
                                    isLoading={isLoading}
                                    sendMessage={sendMessage}
                                    selectedPlatforms={selectedPlatforms}
                                    setSelectedPlatforms={setSelectedPlatforms}
                                    connectedPlatforms={connectedPlatforms}
                                    platformColors={platformColors}
                                    platformIcons={platformIcons}
                                    mounted={mounted}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Chat Messages */
                        <div className="space-y-4 max-w-4xl mx-auto">
                            {currentChat.messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div
                                        className={`max-w-2xl px-4 py-3 rounded-2xl shadow-md ${msg.role === "user"
                                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-sm"
                                            : msg.error
                                                ? "bg-red-900/50 text-red-200 rounded-bl-sm border border-red-700"
                                                : "bg-slate-800/80 text-gray-200 rounded-bl-sm border border-slate-700"
                                            }`}
                                    >
                                        <p className="text-sm leading-relaxed mb-2">
                                            {msg.role === "assistant" && !msg.error ? (
                                                <TypewriterText
                                                    text={msg.content}
                                                    speed={25}
                                                    onComplete={() => {
                                                        setTypingMessageIds(prev => {
                                                            if (prev.has(idx)) return prev
                                                            const newSet = new Set(prev)
                                                            newSet.add(idx)
                                                            return newSet
                                                        })
                                                    }}
                                                />
                                            ) : (
                                                msg.content
                                            )}
                                        </p>

                                        {/* Generated Post Preview */}
                                        {msg.postData && (
                                            <div className="mt-4 space-y-4">
                                                {(() => {
                                                    const imageUrl = msg.postData.image_url || msg.postData.generated_content?.image_url

                                                    if (!imageUrl) return null

                                                    return (
                                                        <div
                                                            className="relative w-48 h-48 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                                            onClick={() => setEnlargedImage(imageUrl)}
                                                        >
                                                            <img
                                                                src={imageUrl}
                                                                alt="Generated post image"
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                                <p className="text-white text-sm">Click to enlarge</p>
                                                            </div>
                                                        </div>
                                                    )
                                                })()}

                                                {(() => {
                                                    const generatedContent = msg.postData.generated_content

                                                    if (generatedContent?.posts && Array.isArray(generatedContent.posts)) {
                                                        return (
                                                            <>
                                                                {generatedContent.posts.map((post, index) => {
                                                                    if (!post || !post.post_text) return null

                                                                    return (
                                                                        <PostWithTypewriter
                                                                            key={`${post.platform}-${index}`}
                                                                            post={post}
                                                                            platformColors={platformColors}
                                                                            platformIcons={platformIcons}
                                                                            onAllComplete={() => { }}
                                                                        />
                                                                    )
                                                                })}
                                                            </>
                                                        )
                                                    }

                                                    return Object.entries(generatedContent || {})
                                                        .filter(([key]) => key !== 'posts' && key !== 'image_url' && key !== 'image_description')
                                                        .map(([platform, content]: [string, any]) => {
                                                            if (!content || !content.post_text) return null

                                                            return (
                                                                <Card key={platform} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <div className={`w-6 h-6 ${platformColors[platform.toLowerCase()] || 'bg-slate-600'} rounded flex items-center justify-center p-1`}>
                                                                            {platformIcons[platform.toLowerCase()] ? (
                                                                                <img src={platformIcons[platform.toLowerCase()]} alt={platform} className="w-full h-full object-contain" />
                                                                            ) : (
                                                                                <span className="text-white text-xs font-bold">{platform.charAt(0).toUpperCase()}</span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-sm font-semibold capitalize text-gray-300">{platform}</span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-300 whitespace-pre-wrap">
                                                                        {content.post_text}
                                                                    </p>
                                                                    {content.hashtags && content.hashtags.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-2">
                                                                            {content.hashtags.map((tag: string, i: number) => (
                                                                                <span key={i} className="text-xs text-emerald-400">
                                                                                    {tag.startsWith('#') ? tag : `#${tag}`}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </Card>
                                                            )
                                                        })
                                                })()}

                                                {/* Action Buttons */}
                                                <div className="flex gap-2 mt-4">
                                                    <Button
                                                        onPress={() => handleApprove(msg.postData!.postId)}
                                                        isLoading={isApproving}
                                                        color="success"
                                                        size="sm"
                                                        startContent={!isApproving && <CheckCircle className="w-4 h-4" />}
                                                    >
                                                        {isApproving ? "Approving..." : "Approve & Post"}
                                                    </Button>
                                                    <Button
                                                        onPress={() => {
                                                            const originalPrompt = currentChat.messages[idx - 1]?.content || ""
                                                            handleRegenerate(originalPrompt)
                                                        }}
                                                        variant="ghost"
                                                        color="warning"
                                                        size="sm"
                                                        startContent={<RefreshCw className="w-4 h-4" />}
                                                    >
                                                        Regenerate
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input Area (when chat is active) */}
                {currentChat && currentChat.messages.length > 0 && (
                    <div className="backdrop-blur-sm p-6">
                        <div className="max-w-4xl mx-auto">
                            <ChatInputArea
                                input={input}
                                setInput={setInput}
                                isLoading={isLoading}
                                sendMessage={sendMessage}
                                selectedPlatforms={selectedPlatforms}
                                setSelectedPlatforms={setSelectedPlatforms}
                                connectedPlatforms={connectedPlatforms}
                                platformColors={platformColors}
                                platformIcons={platformIcons}
                                mounted={mounted}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
