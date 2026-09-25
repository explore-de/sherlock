"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { SherlockLogo } from "@/app/components/sherlockLogo"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function VerificationFailed() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111318] text-white">
      <div className="w-full max-w-md rounded-lg bg-[#1A1D24] p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <SherlockLogo />
        </div>

        <div className="mb-6 text-center">
          <div className="mb-4 flex justify-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <p className="mb-2 text-center text-lg font-medium">Login verification failed</p>
          <p className="text-center text-sm text-gray-400">
            Something went wrong when trying to verify your login. Please try again.
          </p>
        </div>

        <Button onClick={() => router.push("/login")} className="w-full bg-purple-600 hover:bg-purple-700">
          Return to login
        </Button>
      </div>

      <div className="mt-8 flex gap-6 text-sm text-gray-500">
        <Link href="/about#help" className="hover:text-gray-300">
          About
        </Link>
        <Link href="/about#help" className="hover:text-gray-300">
          Help
        </Link>
      </div>
    </div>
  )
}
