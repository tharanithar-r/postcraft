"use client"

import { useState, useEffect } from "react"
import { User, Mail, LogOut, Twitter, Linkedin, CheckCircle, XCircle, X as XIcon, Loader2, Send, ArrowLeft } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import toast, { Toaster } from "react-hot-toast"
import { Button, Card, CardBody, CardHeader, Avatar, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Divider } from "@heroui/react"

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
)

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
)

interface Profile {
  id: string
  name: string
  email: string
  created_at: string
}

interface SocialAccount {
  id: string
  platform: string
  platform_account_id: string | null
  account_username: string | null
  connected_at: string
  platform_data?: {
    pageId?: string
    pageName?: string
    category?: string
    hasPages?: boolean
    userId?: string
    userName?: string
    // Telegram fields
    botToken?: string
    botId?: string
    botUsername?: string
    botName?: string
    channelId?: string
    channelUsername?: string
    channelTitle?: string
    channelType?: string
  }
  metadata?: {
    guild_id?: string
    guild_name?: string
    channel_type?: number
  }
}

interface FacebookPage {
  id: string
  name: string
  category: string
  access_token: string
  tasks?: string[]
}

interface ProfileClientProps {
  profile: Profile
  socialAccounts: SocialAccount[]
  userId: string
}

export default function ProfileClient({ profile, socialAccounts, userId }: ProfileClientProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  // HeroUI Modal hooks
  const { isOpen: isFacebookModalOpen, onOpen: onFacebookModalOpen, onOpenChange: onFacebookModalOpenChange } = useDisclosure()
  const { isOpen: isTelegramModalOpen, onOpen: onTelegramModalOpen, onOpenChange: onTelegramModalOpenChange } = useDisclosure()

  const [availablePages, setAvailablePages] = useState<FacebookPage[]>([])
  const [selectedPages, setSelectedPages] = useState<string[]>([])
  const [isLoadingPages, setIsLoadingPages] = useState(false)
  const [isConnectingPages, setIsConnectingPages] = useState(false)

  // Telegram state
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramStep, setTelegramStep] = useState(1) // 1: Instructions, 2: Token, 3: Channels
  const [isValidatingToken, setIsValidatingToken] = useState(false)
  const [telegramBotInfo, setTelegramBotInfo] = useState<any>(null)
  const [detectedChannels, setDetectedChannels] = useState<any[]>([])
  const [needsManualEntry, setNeedsManualEntry] = useState(false)
  const [manualChannelUsername, setManualChannelUsername] = useState('')
  const [isConnectingChannel, setIsConnectingChannel] = useState(false)

  console.log(profile);

  // Check for Facebook no pages message
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('facebook') === 'no_pages' && params.get('message') === 'create_page') {
      toast.error(
        'No Facebook Pages found. Please create a Facebook Page first, then reconnect.',
        { duration: 6000 }
      );
      // Clean up URL
      window.history.replaceState({}, '', '/profile');
    }
  }, []);

  const isConnected = (platform: string) => {
    return socialAccounts.some(acc => acc.platform.toLowerCase() === platform.toLowerCase())
  }

  const getUsername = (platform: string) => {
    const account = socialAccounts.find(acc => acc.platform.toLowerCase() === platform.toLowerCase())
    return account?.account_username || null
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success("Logged out successfully")
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Logout error:", error)
      toast.error("Failed to logout")
      setIsLoggingOut(false)
    }
  }

  const handleConnect = async (platform: string) => {
    if (platform === "x") {
      window.location.href = "/api/auth/x/login"
    } else if (platform === "facebook") {
      // Redirect to Facebook OAuth - it will handle everything and redirect back
      window.location.href = "/api/auth/facebook/login"
    } else if (platform === "discord") {
      window.location.href = "/api/auth/discord/login"
    } else if (platform === "telegram") {
      // Check if user already has a bot token
      const existingTelegramAccount = socialAccounts.find(acc => acc.platform.toLowerCase() === 'telegram')

      if (existingTelegramAccount) {
        setTelegramBotToken(existingTelegramAccount.platform_data?.botToken || '')
        setTelegramStep(3)
        setIsValidatingToken(true)

        try {
          const response = await fetch('/api/telegram/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ botToken: existingTelegramAccount.platform_data?.botToken })
          })

          const data = await response.json()

          if (response.ok) {
            setTelegramBotInfo(data.botInfo)
            setDetectedChannels(data.channels || [])
            setNeedsManualEntry(data.needsManualEntry || false)
          } else {
            toast.error('Failed to load channels. Please re-enter your bot token.')
            setTelegramStep(2)
          }
        } catch (error) {
          toast.error('Failed to load channels')
          setTelegramStep(2)
        } finally {
          setIsValidatingToken(false)
        }
      } else {
        // First time setup
        setTelegramStep(1)
        setTelegramBotToken('')
        setTelegramBotInfo(null)
        setDetectedChannels([])
        setNeedsManualEntry(false)
        setManualChannelUsername('')
      }

      onTelegramModalOpen()
    } else if (platform === "linkedin") {
      toast.error("LinkedIn integration coming soon!")
    }
  }

  const handleConnectSelectedPages = async () => {
    // This function is for future use if we want to implement selective page connection
    // For now, the callback route handles all pages automatically
    setIsConnectingPages(true)
    try {
      // Implementation would go here if needed
      toast.success("Pages connected successfully!")
      onFacebookModalOpenChange()
      setSelectedPages([])
      router.refresh()
    } catch (error) {
      console.error("Error connecting pages:", error)
      toast.error("Failed to connect pages")
    } finally {
      setIsConnectingPages(false)
    }
  }

  const handleValidateTelegramToken = async () => {
    if (!telegramBotToken.trim()) {
      toast.error('Please enter a bot token')
      return
    }

    setIsValidatingToken(true)
    try {
      const response = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: telegramBotToken.trim() })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to validate bot token')
        return
      }

      setTelegramBotInfo(data.botInfo)
      setDetectedChannels(data.channels || [])
      setNeedsManualEntry(data.needsManualEntry || false)


      if (data.needsManualEntry) {
        setTelegramStep(3)
        toast.error(data.message || 'No channels detected')
      } else {
        setTelegramStep(3)
        toast.success(`Bot validated! Found ${data.channels.length} channel(s)`)
      }
    } catch (error) {
      console.error('Error validating token:', error)
      toast.error('Failed to validate bot token')
    } finally {
      setIsValidatingToken(false)
    }
  }

  const handleConnectTelegramChannel = async (channelUsername?: string) => {
    const channelToConnect = channelUsername || manualChannelUsername.trim()

    if (!channelToConnect) {
      toast.error('Please enter a channel username')
      return
    }

    setIsConnectingChannel(true)
    try {
      const response = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: telegramBotToken.trim(),
          channelUsername: channelToConnect
        })
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to connect channel')
        return
      }

      toast.success(data.message || 'Channel connected successfully!')
      onTelegramModalOpenChange()
      router.refresh()
    } catch (error) {
      console.error('Error connecting channel:', error)
      toast.error('Failed to connect channel')
    } finally {
      setIsConnectingChannel(false)
    }
  }
  const handleDisconnect = async (platform: string, accountId?: string) => {
    const disconnectKey = accountId ? `${platform}-${accountId}` : platform

    let confirmMessage = `Are you sure you want to disconnect your ${platform.toUpperCase()} account?`
    if (platform === 'facebook' && accountId) {
      confirmMessage = 'Are you sure you want to disconnect this Facebook page?'
    } else if (platform === 'telegram' && accountId) {
      confirmMessage = 'Are you sure you want to disconnect this Telegram channel?'
    } else if (platform === 'discord' && accountId) {
      confirmMessage = 'Are you sure you want to disconnect this Discord channel?'
    }

    if (!confirm(confirmMessage)) {
      return
    }

    setDisconnecting(disconnectKey)
    try {
      let url = `/api/${platform}/disconnect`

      if (platform === 'facebook' && accountId) {
        url += `?pageId=${accountId}`
      } else if (platform === 'telegram' && accountId) {
        url += `?channelId=${accountId}`
      } else if (platform === 'discord' && accountId) {
        url += `?channelId=${accountId}`
      }

      const response = await fetch(url, {
        method: "DELETE",
      })

      if (response.ok) {
        let successMessage = `${platform.toUpperCase()} account disconnected`
        if (platform === 'facebook' && accountId) {
          successMessage = 'Facebook page disconnected'
        } else if (platform === 'telegram' && accountId) {
          successMessage = 'Telegram channel disconnected'
        } else if (platform === 'discord' && accountId) {
          successMessage = 'Discord channel disconnected'
        }
        toast.success(successMessage)
        router.refresh()
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to disconnect")
      }
    } catch (error) {
      console.error("Disconnect error:", error)
      toast.error("Failed to disconnect")
    } finally {
      setDisconnecting(null)
    }
  }

  const xConnected = isConnected("x")
  const linkedinConnected = isConnected("linkedin")
  const xUsername = getUsername("x")
  const linkedinUsername = getUsername("linkedin")

  // Get Facebook pages
  const facebookPages = socialAccounts.filter(acc => acc.platform.toLowerCase() === 'facebook')
  const facebookConnectedNoPages = facebookPages.length === 1 && facebookPages[0].platform_data?.hasPages === false

  // Get Telegram channels
  const telegramChannels = socialAccounts.filter(acc => acc.platform.toLowerCase() === 'telegram')

  // Get Discord channels
  const discordChannels = socialAccounts.filter(acc => acc.platform.toLowerCase() === 'discord')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-4 md:p-8">
      <Toaster position="top-center" />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              onPress={() => router.push('/home')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold text-white">Profile</h1>
          </div>
          <Button
            color="danger"
            variant="flat"
            startContent={<LogOut className="w-4 h-4" />}
            onPress={handleLogout}
            isLoading={isLoggingOut}
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </Button>
        </div>

        {/* User Info Card */}
        <Card className="bg-slate-900/50 backdrop-blur-sm border border-slate-700">
          <CardBody className="p-8">
            <div className="flex items-start gap-6">
              {/* Avatar */}
              <Avatar
                icon={<User className="w-12 h-12" />}
                className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500"
              />

              {/* User Details */}
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{profile.name || "User"}</h2>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span>{profile.email}</span>
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  Member since {new Date(profile.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric"
                  })}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Social Media Connections Card */}
        <Card className="bg-slate-900/50 backdrop-blur-sm border border-slate-700">
          <CardBody className="p-8">
            <h3 className="text-xl font-bold text-white mb-6">Social Media Accounts</h3>

            <div className="space-y-4">
              {/* X/Twitter */}
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl border border-gray-600 hover:border-gray-500 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center">
                    <Twitter className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white">X (Twitter)</h4>
                      {xConnected ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    {xConnected && xUsername ? (
                      <p className="text-sm text-gray-400">@{xUsername}</p>
                    ) : (
                      <p className="text-sm text-gray-500">Not connected</p>
                    )}
                  </div>
                </div>

                {xConnected ? (
                  <button
                    onClick={() => handleDisconnect("x")}
                    disabled={disconnecting === "x"}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {disconnecting === "x" ? "Disconnecting..." : "Disconnect"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect("x")}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    Connect
                  </button>
                )}
              </div>

              {/* Telegram */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl border border-gray-600 hover:border-gray-500 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-400 flex items-center justify-center">
                      <Send className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">Telegram</h4>
                        {telegramChannels.length > 0 && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        {telegramChannels.length > 0
                          ? `${telegramChannels.length} channel(s) connected`
                          : "Not connected"
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {telegramChannels.length > 0 && (
                      <button
                        onClick={() => handleConnect("telegram")}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        Add More Channels
                      </button>
                    )}
                    {telegramChannels.length === 0 ? (
                      <button
                        onClick={() => handleConnect("telegram")}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        Connect
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Connected Telegram Channels List */}
                {telegramChannels.length > 0 && (
                  <div className="ml-16 space-y-2">
                    {telegramChannels.map((channel) => (
                      <div
                        key={channel.id}
                        className="flex items-center justify-between p-3 bg-gray-700/20 rounded-lg border border-gray-600/50 hover:border-gray-500/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-400/20 flex items-center justify-center">
                            <Send className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-200">
                              {channel.account_username}
                            </p>
                            {channel.platform_data?.channelUsername && (
                              <p className="text-xs text-gray-500">
                                @{channel.platform_data.channelUsername}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDisconnect("telegram", channel.platform_account_id!)}
                          disabled={disconnecting === `telegram-${channel.platform_account_id}`}
                          className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-md transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {disconnecting === `telegram-${channel.platform_account_id}` ? "..." : "Disconnect"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discord */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl border border-gray-600 hover:border-gray-500 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center">
                      <DiscordIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">Discord</h4>
                        {discordChannels.length > 0 && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        {discordChannels.length > 0
                          ? `${discordChannels.length} channel(s) connected`
                          : "Not connected"
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {discordChannels.length > 0 && (
                      <button
                        onClick={() => handleConnect("discord")}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        Add More Channels
                      </button>
                    )}
                    {discordChannels.length === 0 ? (
                      <button
                        onClick={() => handleConnect("discord")}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        Connect
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Connected Discord Channels List */}
                {discordChannels.length > 0 && (
                  <div className="ml-16 space-y-2">
                    {discordChannels.map((channel) => (
                      <div
                        key={channel.id}
                        className="flex items-center justify-between p-3 bg-gray-700/20 rounded-lg border border-gray-600/50 hover:border-gray-500/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                            <DiscordIcon className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-200">
                              {channel.account_username}
                              {channel.metadata?.guild_name && (
                                <span className="text-gray-500"> ({channel.metadata.guild_name})</span>
                              )}
                            </p>
                            {channel.metadata?.channel_type !== undefined && (
                              <p className="text-xs text-gray-500">
                                {channel.metadata.channel_type === 0 ? 'Text Channel' : 'Announcement Channel'}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDisconnect("discord", channel.platform_account_id!)}
                          disabled={disconnecting === `discord-${channel.platform_account_id}`}
                          className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-md transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {disconnecting === `discord-${channel.platform_account_id}` ? "..." : "Disconnect"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* LinkedIn */}
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl border border-gray-600 hover:border-gray-500 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                    <Linkedin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white">LinkedIn</h4>
                      {linkedinConnected ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    {linkedinConnected && linkedinUsername ? (
                      <p className="text-sm text-gray-400">@{linkedinUsername}</p>
                    ) : (
                      <p className="text-sm text-gray-500">Coming soon</p>
                    )}
                  </div>
                </div>

                {linkedinConnected ? (
                  <button
                    onClick={() => handleDisconnect("linkedin")}
                    disabled={disconnecting === "linkedin"}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {disconnecting === "linkedin" ? "Disconnecting..." : "Disconnect"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect("linkedin")}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium cursor-not-allowed opacity-50"
                    disabled
                  >
                    Coming Soon
                  </button>
                )}
              </div>


              {/* Facebook */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl border border-gray-600 hover:border-gray-500 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                      <FacebookIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white">Facebook</h4>
                        {facebookPages.length > 0 && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-400">
                        {facebookPages.length > 0
                          ? `${facebookPages.length} page(s) connected`
                          : "Not connected"
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {facebookPages.length > 0 && (
                      <button
                        onClick={() => handleConnect("facebook")}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        Add More Pages
                      </button>
                    )}
                    {facebookPages.length === 0 ? (
                      <button
                        onClick={() => handleConnect("facebook")}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium cursor-not-allowed opacity-50"
                        disabled
                      >
                        Coming Soon
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Connected Facebook Pages List or No Pages Message */}
                {facebookConnectedNoPages ? (
                  <div className="ml-16 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                    <p className="text-sm text-yellow-300 mb-2">
                      No Facebook Pages found
                    </p>
                    <p className="text-xs text-yellow-400/80 mb-3">
                      You need to create a Facebook Page to post content. Personal profiles cannot be used for posting.
                    </p>
                    <div className="flex gap-2">
                      <a
                        href="https://www.facebook.com/pages/create"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-xs font-medium"
                      >
                        Create Facebook Page
                      </a>
                      <button
                        onClick={() => handleDisconnect("facebook")}
                        disabled={disconnecting === "facebook"}
                        className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-md transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {disconnecting === "facebook" ? "..." : "Disconnect"}
                      </button>
                    </div>
                  </div>
                ) : facebookPages.length > 0 ? (
                  <div className="ml-16 space-y-2">
                    {facebookPages.map((page) => (
                      <div
                        key={page.id}
                        className="flex items-center justify-between p-3 bg-gray-700/20 rounded-lg border border-gray-600/50 hover:border-gray-500/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <FacebookIcon className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-200">
                              {page.account_username || page.platform_data?.pageName}
                            </p>
                            {page.platform_data?.category && (
                              <p className="text-xs text-gray-500">
                                {page.platform_data.category}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDisconnect("facebook", page.platform_account_id!)}
                          disabled={disconnecting === `facebook-${page.platform_account_id}`}
                          className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-md transition-colors text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {disconnecting === `facebook-${page.platform_account_id}` ? "..." : "Disconnect"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Info Message */}
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <p className="text-sm text-blue-300">
                Connect your social media accounts to start posting and managing your content across platforms.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Facebook Page Selection Modal */}
      <Modal
        isOpen={isFacebookModalOpen}
        onOpenChange={onFacebookModalOpenChange}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-slate-800 border border-slate-700",
          header: "border-b border-slate-700",
          body: "py-6",
          footer: "border-t border-slate-700"
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-white">Select Facebook Pages</h3>
                <p className="text-sm text-gray-400 font-normal">Choose which pages you want to connect</p>
              </ModalHeader>

              <ModalBody>
                {isLoadingPages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                ) : availablePages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 mb-4">No Facebook pages found</p>
                    <p className="text-sm text-gray-500">
                      Create a Facebook Page first, then try connecting again.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availablePages.map((page) => {
                      const isSelected = selectedPages.includes(page.id)
                      const isAlreadyConnected = facebookPages.some(
                        fp => fp.platform_account_id === page.id
                      )

                      return (
                        <button
                          key={page.id}
                          onClick={() => {
                            if (isAlreadyConnected) return
                            setSelectedPages(prev =>
                              prev.includes(page.id)
                                ? prev.filter(id => id !== page.id)
                                : [...prev, page.id]
                            )
                          }}
                          disabled={isAlreadyConnected}
                          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${isAlreadyConnected
                            ? 'bg-gray-700/30 border-gray-600 opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'bg-blue-600/20 border-blue-500'
                              : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                              <FacebookIcon className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-left">
                              <p className="font-medium text-white">{page.name}</p>
                              <p className="text-sm text-gray-400">{page.category}</p>
                            </div>
                          </div>
                          {isAlreadyConnected ? (
                            <span className="text-xs text-green-500 font-medium">Already Connected</span>
                          ) : isSelected ? (
                            <CheckCircle className="w-6 h-6 text-blue-500" />
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-gray-500" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </ModalBody>

              <ModalFooter>
                <div className="flex items-center justify-between w-full">
                  <p className="text-sm text-gray-400">
                    {selectedPages.length} page(s) selected
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="flat"
                      onPress={() => {
                        onClose()
                        setSelectedPages([])
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      color="primary"
                      onPress={handleConnectSelectedPages}
                      isDisabled={selectedPages.length === 0}
                      isLoading={isConnectingPages}
                      startContent={!isConnectingPages && <CheckCircle className="w-4 h-4" />}
                    >
                      {isConnectingPages
                        ? "Connecting..."
                        : `Connect ${selectedPages.length > 0 ? selectedPages.length : ''} Page${selectedPages.length !== 1 ? 's' : ''}`
                      }
                    </Button>
                  </div>
                </div>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Telegram Bot Connection Modal */}
      <Modal
        isOpen={isTelegramModalOpen}
        onOpenChange={onTelegramModalOpenChange}
        size="2xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-slate-800 border border-slate-700",
          header: "border-b border-slate-700",
          body: "py-6",
          footer: "border-t border-slate-700"
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-white">Connect Telegram Bot</h3>
                <p className="text-sm text-gray-400 font-normal">Step {telegramStep} of 3</p>
              </ModalHeader>

              <ModalBody>
                {telegramStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-300 mb-2">📱 Step 1: Create a Telegram Bot</h4>
                      <ol className="text-sm text-blue-200 space-y-2 list-decimal list-inside">
                        <li>Open Telegram and search for <code className="bg-gray-700 px-1 rounded">@BotFather</code></li>
                        <li>Send the command <code className="bg-gray-700 px-1 rounded">/newbot</code></li>
                        <li>Choose a name for your bot (e.g., "My Posting Bot")</li>
                        <li>Choose a username ending in "bot" (e.g., "myposting_bot")</li>
                        <li>Copy the bot token that @BotFather gives you</li>
                      </ol>
                      <a
                        href="https://t.me/BotFather"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
                      >
                        <Send className="w-4 h-4" />
                        Open @BotFather
                      </a>
                    </div>

                    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                      <h4 className="font-semibold text-yellow-300 mb-2">🔧 Step 2: Add Bot to Channel</h4>
                      <ol className="text-sm text-yellow-200 space-y-2 list-decimal list-inside">
                        <li>Go to your Telegram channel</li>
                        <li>Click on channel name → "Manage Channel"</li>
                        <li>Go to "Administrators" → "Add Administrator"</li>
                        <li>Search for your bot username</li>
                        <li>Add bot and give "Post Messages" permission</li>
                      </ol>
                    </div>

                    <Button
                      color="success"
                      onPress={() => setTelegramStep(2)}
                      className="w-full"
                      size="lg"
                    >
                      I've Created My Bot → Next
                    </Button>
                  </div>
                )}

                {telegramStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold text-white mb-3">🔑 Enter Your Bot Token</h4>
                      <p className="text-sm text-gray-400 mb-4">
                        Paste the token that @BotFather gave you. It looks like: <code className="bg-gray-700 px-1 rounded text-xs">123456789:ABCdefGHI...</code>
                      </p>
                      <Input
                        type="text"
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                        variant="bordered"
                        classNames={{
                          input: "text-white",
                          inputWrapper: "bg-slate-700 border-slate-600"
                        }}
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="flat"
                        onPress={() => setTelegramStep(1)}
                      >
                        ← Back
                      </Button>
                      <Button
                        color="primary"
                        onPress={handleValidateTelegramToken}
                        isDisabled={!telegramBotToken.trim()}
                        isLoading={isValidatingToken}
                        className="flex-1"
                        startContent={!isValidatingToken && <CheckCircle className="w-4 h-4" />}
                      >
                        {isValidatingToken ? 'Validating...' : 'Validate & Continue'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: Channel Selection or Manual Entry */}
                {telegramStep === 3 && (
                  <div className="space-y-6">
                    {telegramBotInfo && (
                      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                        <h4 className="font-semibold text-green-300 mb-2">✅ Bot Validated</h4>
                        <p className="text-sm text-green-200">
                          Bot: <strong>@{telegramBotInfo.username}</strong> ({telegramBotInfo.first_name})
                        </p>
                      </div>
                    )}

                    {detectedChannels.length > 0 ? (
                      <div>
                        <h4 className="font-semibold text-white mb-3">📢 Detected Channels</h4>
                        <p className="text-sm text-gray-400 mb-4">
                          Click on a channel to connect:
                        </p>
                        <div className="space-y-2">
                          {detectedChannels.map((channel) => (
                            <button
                              key={channel.id}
                              onClick={() => handleConnectTelegramChannel(channel.username ? `@${channel.username}` : channel.id.toString())}
                              disabled={isConnectingChannel}
                              className="w-full flex items-center justify-between p-3 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <div className="flex items-center gap-3">
                                <Send className="w-5 h-5 text-blue-400" />
                                <div className="text-left">
                                  <p className="font-medium text-white">{channel.title || `Channel ${channel.id}`}</p>
                                  {channel.username && (
                                    <p className="text-sm text-gray-400">@{channel.username}</p>
                                  )}
                                </div>
                              </div>
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {(needsManualEntry || detectedChannels.length > 0) && (
                      <div>
                        <h4 className="font-semibold text-white mb-3">
                          {detectedChannels.length > 0 ? '📝 Or Enter Channel Manually' : '📝 Enter Channel Username'}
                        </h4>
                        <p className="text-sm text-gray-400 mb-4">
                          Enter your channel username (with or without @):
                        </p>
                        <Input
                          type="text"
                          value={manualChannelUsername}
                          onChange={(e) => setManualChannelUsername(e.target.value)}
                          placeholder="@mychannel or mychannel"
                          variant="bordered"
                          classNames={{
                            input: "text-white",
                            inputWrapper: "bg-slate-700 border-slate-600"
                          }}
                          className="mb-4"
                        />
                        <Button
                          color="success"
                          onPress={() => handleConnectTelegramChannel()}
                          isDisabled={!manualChannelUsername.trim()}
                          isLoading={isConnectingChannel}
                          className="w-full"
                          startContent={!isConnectingChannel && <CheckCircle className="w-4 h-4" />}
                        >
                          {isConnectingChannel ? 'Connecting...' : 'Connect Channel'}
                        </Button>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        variant="flat"
                        onPress={() => setTelegramStep(2)}
                      >
                        ← Back
                      </Button>
                    </div>
                  </div>
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}