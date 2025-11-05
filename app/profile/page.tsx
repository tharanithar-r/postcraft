import { redirect } from "next/navigation"
import ProfileClient from "@/components/ProfileClient"
import { createClient } from "@/utils/supabase/server"

export default async function ProfilePage() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect("/login")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (profileError) {
    console.error("Profile fetch error:", profileError)
  }

  const { data: socialAccounts, error: socialError } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("user_id", user.id)

  if (socialError) {
    console.error("Social accounts fetch error:", socialError)
  }

  return (
    <ProfileClient 
      profile={profile} 
      socialAccounts={socialAccounts || []}
      userId={user.id}
    />
  )
}
