"use client"
import { useState } from "react"
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import toast, { Toaster } from "react-hot-toast"
import { useRouter } from "next/navigation"

export default function Signup() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  })
  const router = useRouter()

  const validateForm = () => {
    if (!isLogin) {
      if (!formData.name.trim()) {
        toast.error("Please enter your name")
        return false
      }
      if (formData.name.trim().length < 2) {
        toast.error("Name must be at least 2 characters")
        return false
      }
    }

    if (!formData.email.trim()) {
      toast.error("Please enter your email")
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address")
      return false
    }

    if (!formData.password) {
      toast.error("Please enter your password")
      return false
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters")
      return false
    }

    if (!isLogin) {
      if (!formData.confirmPassword) {
        toast.error("Please confirm your password")
        return false
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error("Passwords do not match")
        return false
      }
    }

    return true
  }

  const handleSignup = async () => {
    try {
      console.log("Starting signup with:", {
        email: formData.email,
        name: formData.name.trim()
      })

      const supabase = createClient()

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name.trim(),
          },
        },
      })

      console.log("Signup response:", { data, error })

      if (error) {
        console.error("Supabase signup error:", error)
        if (error.message.includes("already registered") || error.message.includes("already been registered")) {
          toast.error("This email is already registered. Please login.")
        } else if (error.message.includes("Email rate limit exceeded")) {
          toast.error("Too many signup attempts. Please try again later.")
        } else if (error.message.includes("Invalid email")) {
          toast.error("Please enter a valid email address.")
        } else if (error.status === 500) {
          toast.error("Server error. Please check your Supabase email settings or disable email confirmation.")
        } else {
          toast.error(error.message || "Signup failed. Please try again.")
        }
        return
      }

      if (data.user) {
        const needsConfirmation = data.user.identities && data.user.identities.length === 0

        if (needsConfirmation) {
          toast.success("Account created! Please check your email to verify your account.", {
            duration: 5000,
          })
        } else {
          toast.success("Account created successfully! You can now login.", {
            duration: 4000,
          })
        }

        setFormData({
          name: "",
          email: "",
          password: "",
          confirmPassword: ""
        })

        setTimeout(() => {
          setIsLogin(true)
        }, 1500)
      }
    } catch (error: any) {
      console.error("Signup error:", error)
      toast.error(error?.message || "An unexpected error occurred. Please try again.")
    }
  }

  const handleLogin = async () => {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      })

      if (error) {
        console.error("Login error:", error)
        toast.error("Invalid email or password")
        return
      }

      if (data.user) {
        toast.success("Login successful!")
        router.push("/home")
        router.refresh()
      }
    } catch (error) {
      console.error("Login error:", error)
      toast.error("An unexpected error occurred. Please try again.")
    }
  }

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      if (isLogin) {
        await handleLogin()
      } else {
        await handleSignup()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-emerald-50 via-teal-50 to-cyan-50 p-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-emerald-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 bg-linear-to-br from-emerald-400 to-teal-500 rounded-full shadow-lg mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-2">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h2>
            <p className="text-slate-600">
              {isLogin ? "Log in to continue" : "Sign up to get started"}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Name field - only for signup */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-emerald-50/50 border border-emerald-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            {/* Email field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-emerald-50/50 border border-emerald-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 rounded-lg bg-emerald-50/50 border border-emerald-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password - only for signup */}
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-emerald-50/50 border border-emerald-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            )}

            {/* Forgot Password - only for login */}
            {isLogin && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm text-emerald-600 cursor-pointer hover:text-emerald-700 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full py-3 bg-linear-to-r cursor-pointer from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all transform hover:scale-105 shadow-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isLogin ? "Logging in..." : "Creating account..."}
                </span>
              ) : (
                isLogin ? "Log In" : "Create Account"
              )}
            </button>
          </div>

          {/* Toggle between login and signup */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-emerald-600 cursor-pointer  x hover:text-emerald-700 font-medium transition-colors"
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}