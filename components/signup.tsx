"use client"
import { useState } from "react"
import { Mail, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import toast, { Toaster } from "react-hot-toast"
import { useRouter } from "next/navigation"
import { Button, Input, Card, CardHeader, CardBody, CardFooter, Divider } from "@heroui/react"

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-md">
        <Card className="bg-gray-800/50 backdrop-blur-md border-gray-700">
          <CardHeader className="flex flex-col gap-3 items-center pb-6">
            <div className="inline-flex p-3 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full shadow-lg">
              <UserIcon className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-2">
                {isLogin ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="text-gray-400">
                {isLogin ? "Log in to continue" : "Sign up to get started"}
              </p>
            </div>
          </CardHeader>
          
          <Divider className="bg-gray-700" />

          <CardBody className="gap-4 py-6">
            {/* Name field - only for signup */}
            {!isLogin && (
              <Input
                type="text"
                name="name"
                label="Full Name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleInputChange}
                startContent={<UserIcon className="w-4 h-4 text-gray-400" />}
                variant="bordered"
                classNames={{
                  input: "text-white",
                  inputWrapper: "border-gray-600 hover:border-gray-500 focus-within:!border-emerald-500",
                  label: "text-gray-400"
                }}
              />
            )}

            {/* Email field */}
            <Input
              type="email"
              name="email"
              label="Email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleInputChange}
              startContent={<Mail className="w-4 h-4 text-gray-400" />}
              variant="bordered"
              classNames={{
                input: "text-white",
                inputWrapper: "border-gray-600 hover:border-gray-500 focus-within:!border-emerald-500",
                label: "text-gray-400"
              }}
            />

            {/* Password field */}
            <Input
              type={showPassword ? "text" : "password"}
              name="password"
              label="Password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleInputChange}
              startContent={<Lock className="w-4 h-4 text-gray-400" />}
              endContent={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400 hover:text-gray-300" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400 hover:text-gray-300" />
                  )}
                </button>
              }
              variant="bordered"
              classNames={{
                input: "text-white",
                inputWrapper: "border-gray-600 hover:border-gray-500 focus-within:!border-emerald-500",
                label: "text-gray-400"
              }}
            />

            {/* Confirm Password - only for signup */}
            {!isLogin && (
              <Input
                type={showPassword ? "text" : "password"}
                name="confirmPassword"
                label="Confirm Password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                startContent={<Lock className="w-4 h-4 text-gray-400" />}
                variant="bordered"
                classNames={{
                  input: "text-white",
                  inputWrapper: "border-gray-600 hover:border-gray-500 focus-within:!border-emerald-500",
                  label: "text-gray-400"
                }}
              />
            )}

            {/* Forgot Password - only for login */}
            {isLogin && (
              <div className="flex justify-end">
                <Button
                  variant="light"
                  size="sm"
                  className="text-emerald-500 hover:text-emerald-400"
                >
                  Forgot password?
                </Button>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              isLoading={isLoading}
              color="success"
              size="lg"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold mt-2"
            >
              {isLogin ? "Log In" : "Create Account"}
            </Button>
          </CardBody>

          <Divider className="bg-gray-700" />

          <CardFooter className="justify-center py-4">
            <p className="text-sm text-gray-400">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Button
                variant="light"
                size="sm"
                onClick={() => setIsLogin(!isLogin)}
                className="text-emerald-500 hover:text-emerald-400 font-semibold p-0 h-auto min-w-0"
              >
                {isLogin ? "Sign up" : "Log in"}
              </Button>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}