"use client"

import { useState } from "react"
import { User, Mail, LogOut, Twitter, Linkedin, CheckCircle, XCircle } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import toast, { Toaster } from "react-hot-toast"

interface Profile {
  id: string
  name: string
  email: string
  created_at: string
}

interface SocialAccount {
  id: string
  platform: string
  account_username: string | null
  connected_at: string
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

  console.log(profile);

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

  const handleConnect = (platform: string) => {
    if (platform === "x") {
      window.location.href = "/api/auth/x/login"
    } else if (platform === "linkedin") {
      toast.error("LinkedIn integration coming soon!")
    }
  }

  const handleDisconnect = async (platform: string) => {
    if (!confirm(`Are you sure you want to disconnect your ${platform.toUpperCase()} account?`)) {
      return
    }

    setDisconnecting(platform)
    try {
      const response = await fetch(`/api/${platform}/disconnect`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success(`${platform.toUpperCase()} account disconnected`)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
      <Toaster position="top-center" />
      
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Profile</h1>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4" />
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>

        {/* User Info Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                <User className="w-12 h-12 text-white" />
              </div>
            </div>

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
        </div>

        {/* Social Media Connections Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700">
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
          </div>

          {/* Info Message */}
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
            <p className="text-sm text-blue-300">
              💡 Connect your social media accounts to start posting and managing your content across platforms.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
