import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { LandingHeader } from "@/components/landing/LandingHeader"
import { LandingHero } from "@/components/landing/LandingHero"
import { FlowVisual } from "@/components/landing/FlowVisual"

export default async function HomePage() {
  console.log("HomePage rendering");
  const { userId } = await auth()

  if (userId) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-[#EAEAEA] font-sans selection:bg-black selection:text-[#EBFF00] overflow-x-hidden">
      <LandingHeader />
      <main className="relative pt-20">
        <LandingHero />
        <FlowVisual />
      </main>
    </div>
  )
}
