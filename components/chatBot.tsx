"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Trash2, Send, MessageSquare, ChevronDown, Check, X as XIcon, Loader2, RefreshCw, CheckCircle, Search, Menu, LogOut, User as UserIcon } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import toast, { Toaster } from "react-hot-toast"
import { checkAndRefreshAllPlatforms } from "@/lib/token-refresh"
import { Input, Button, Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Divider } from "@heroui/react"

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
}

export default function ChatBot() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [connectedPlatforms, setConnectedPlatforms] = useState<SocialAccount[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [showPlatformMenu, setShowPlatformMenu] = useState(false)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const platformMenuRef = useRef<HTMLDivElement>(null)

  const currentChat = chats.find((c) => c.id === currentChatId)

  const platformIcons: { [key: string]: string } = {
    x: "𝕏",
    linkedin: "in",
    facebook: "f",
    discord: "D"
  }

  const platformColors: { [key: string]: string } = {
    x: "bg-black",
    linkedin: "bg-blue-600",
    facebook: "bg-blue-500",
    discord: "bg-indigo-500"
  }

  const newChat = () => {
    const id = Date.now().toString();
    console.log(id);
    const chat: Chat = { id, title: "New Chat", messages: [] }
    setChats([chat, ...chats])
    setCurrentChatId(id)
  }

  const deleteChat = (id: string) => {
    setChats(chats.filter((c) => c.id !== id))
    if (currentChatId === id) {
      setCurrentChatId(chats[0]?.id || null)
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

        // Fetch connected platforms
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (platformMenuRef.current && !platformMenuRef.current.contains(event.target as Node)) {
        setShowPlatformMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

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

      // Check if any platform needs reconnection
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

          // Add error message to chat
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

      // Add error message
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

      // Parse platforms status (it's a JSON string)
      let platformsStatus: Record<string, string> = {}
      try {
        platformsStatus = typeof result.platforms === 'string'
          ? JSON.parse(result.platforms)
          : result.platforms
      } catch (e) {
        console.error('Failed to parse platforms status:', e)
      }

      // Categorize platforms by status
      const successPlatforms = Object.entries(platformsStatus)
        .filter(([_, status]) => status === 'success')
        .map(([platform]) => platform.toUpperCase())

      const failedPlatformsList = Object.entries(platformsStatus)
        .filter(([_, status]) => status !== 'success')
        .map(([platform, status]) => ({ platform: platform.toUpperCase(), status }))

      // Generate status message
      let statusMessage = ''
      let isError = false

      if (result.overallStatus === 'published' && successPlatforms.length > 0) {
        // All platforms successful
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
    setShowPlatformMenu(false)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentChat?.messages])
  useEffect(() => {
    newChat()
  }, [])


  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Toaster position="top-center" />

      {/* Image Enlargement Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <XIcon className="w-8 h-8" />
            </button>
            <img
              src={enlargedImage}
              alt="Enlarged preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-72 bg-gray-800/50 backdrop-blur-sm border-r border-gray-700 p-4 flex flex-col shadow-lg">
        <button
          onClick={newChat}
          className="w-full cursor-pointer mb-6 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> New Chat
        </button>

        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group p-3 rounded-lg cursor-pointer transition-all ${currentChatId === chat.id
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                : "bg-gray-700/50 hover:bg-gray-700 text-gray-200"
                }`}
              onClick={() => setCurrentChatId(chat.id)}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="truncate flex-1 text-sm font-medium">{chat.title}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteChat(chat.id)
                  }}
                  className="opacity-0 cursor-pointer group-hover:opacity-100 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      {currentChat && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {currentChat.messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="inline-flex p-3 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-full shadow-lg">
                    <MessageSquare className="w-12 h-12 text-white" />
                  </div>
                  <p className="text-gray-400 text-lg">Start creating social media posts</p>
                  <p className="text-gray-500 text-sm">Select platforms and describe your post</p>
                </div>
              </div>
            ) : (
              <>
                {currentChat.messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-2xl px-4 py-3 rounded-2xl shadow-md ${msg.role === "user"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-sm"
                        : msg.error
                          ? "bg-red-900/50 text-red-200 rounded-bl-sm border border-red-700"
                          : "bg-gray-800/80 text-gray-200 rounded-bl-sm border border-gray-700"
                        }`}
                    >
                      <p className="text-sm leading-relaxed mb-2">{msg.content}</p>

                      {/* Generated Post Preview */}
                      {msg.postData && (
                        <div className="mt-4 space-y-4">
                          {(() => {
                            const imageUrl = msg.postData.generated_content?.image_url

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

                            // New format: posts array
                            if (generatedContent?.posts && Array.isArray(generatedContent.posts)) {
                              return generatedContent.posts.map((post, index) => {
                                if (!post || !post.post_text) return null

                                return (
                                  <div key={`${post.platform}-${index}`} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className={`w-6 h-6 ${platformColors[post.platform.toLowerCase()] || 'bg-gray-600'} rounded flex items-center justify-center text-white text-xs font-bold`}>
                                        {platformIcons[post.platform.toLowerCase()] || post.platform.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-sm font-semibold capitalize text-gray-300">{post.platform}</span>
                                    </div>
                                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{post.post_text}</p>
                                    {post.hashtags && post.hashtags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {post.hashtags.map((tag, i) => (
                                          <span key={i} className="text-xs text-emerald-400">
                                            {tag.startsWith('#') ? tag : `#${tag}`}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            }

                            // Legacy format: platform as object keys
                            return Object.entries(generatedContent || {})
                              .filter(([key]) => key !== 'posts' && key !== 'image_url' && key !== 'image_description')
                              .map(([platform, content]: [string, any]) => {
                                if (!content || !content.post_text) return null

                                return (
                                  <div key={platform} className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className={`w-6 h-6 ${platformColors[platform.toLowerCase()] || 'bg-gray-600'} rounded flex items-center justify-center text-white text-xs font-bold`}>
                                        {platformIcons[platform.toLowerCase()] || platform.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-sm font-semibold capitalize text-gray-300">{platform}</span>
                                    </div>
                                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{content.post_text}</p>
                                    {content.hashtags && content.hashtags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {content.hashtags.map((tag: string, i: number) => (
                                          <span key={i} className="text-xs text-emerald-400">
                                            {tag.startsWith('#') ? tag : `#${tag}`}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                          })()}

                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleApprove(msg.postData!.postId)}
                              disabled={isApproving}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                            >
                              {isApproving ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Approving...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Approve & Post
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                const originalPrompt = currentChat.messages[idx - 1]?.content || ""
                                handleRegenerate(originalPrompt)
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Regenerate
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-700 bg-gray-800/80 backdrop-blur-sm p-4 shadow-lg">
            <div className="flex gap-3 max-w-4xl mx-auto">
              {/* Platform Selector */}
              <div className="relative" ref={platformMenuRef}>
                <button
                  onClick={() => setShowPlatformMenu(!showPlatformMenu)}
                  disabled={connectedPlatforms.length === 0}
                  className="flex items-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-600"
                >
                  {selectedPlatforms.length > 0 ? (
                    <div className="flex gap-1">
                      {selectedPlatforms.map(platform => (
                        <div
                          key={platform}
                          className={`w-6 h-6 ${platformColors[platform]} rounded flex items-center justify-center text-white text-xs font-bold`}
                        >
                          {platformIcons[platform]}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Select platforms</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {/* Platform Dropdown */}
                {showPlatformMenu && (
                  <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 min-w-[200px] z-10">
                    <div className="text-xs text-gray-400 px-2 py-1 mb-1">Select Platforms</div>
                    {connectedPlatforms.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-gray-500">
                        No platforms connected. Visit your profile to connect.
                      </div>
                    ) : (
                      connectedPlatforms.map(account => (
                        <button
                          key={account.id}
                          onClick={() => togglePlatform(account.platform.toLowerCase())}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700 rounded transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 ${platformColors[account.platform.toLowerCase()]} rounded flex items-center justify-center text-white text-xs font-bold`}>
                              {platformIcons[account.platform.toLowerCase()]}
                            </div>
                            <span className="text-sm text-gray-200 capitalize">{account.platform}</span>
                            {account.account_username && (
                              <span className="text-xs text-gray-500">@{account.account_username}</span>
                            )}
                          </div>
                          {selectedPlatforms.includes(account.platform.toLowerCase()) && (
                            <Check className="w-4 h-4 text-emerald-500" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Message Input */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && sendMessage()}
                placeholder="Describe your post..."
                disabled={isLoading || selectedPlatforms.length === 0}
                className="flex-1 px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />

              {/* Send Button */}
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || selectedPlatforms.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>
            </div>

            {/* Helper Text */}
            {connectedPlatforms.length === 0 && (
              <div className="text-center mt-2">
                <p className="text-xs text-gray-500">
                  Connect your social media accounts in your profile to start posting
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}