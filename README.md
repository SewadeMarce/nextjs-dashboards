Je vais vous montrer la configuration **moderne** de NextAuth.js v5 (Auth.js) avec les dernières pratiques.

## Auth.js v5 - Configuration Moderne

### 1. Installation

```bash
npm install next-auth@beta
```

### 2. Configuration centralisée

Créez `auth.ts` à la racine du projet :

```typescript
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        // Validation avec Zod
        const { email, password } = credentials
        
        // Logique d'authentification
        const user = await prisma.user.findUnique({
          where: { email: email as string }
        })
        
        if (!user) return null
        
        // Vérifier le mot de passe (avec bcrypt)
        const isValid = await bcrypt.compare(
          password as string, 
          user.password
        )
        
        if (!isValid) return null
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],
  
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Premier login
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      
      // Update session
      if (trigger === "update" && session) {
        token = { ...token, ...session }
      }
      
      return token
    },
    
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  
  pages: {
    signIn: "/login",
    error: "/error",
  },
  
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
  },
  
  trustHost: true,
})
```

### 3. Route Handler

**`app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/auth"

export const { GET, POST } = handlers
```

### 4. Variables d'environnement

**`.env.local`**

```env
AUTH_SECRET=your_super_secret_key_here
AUTH_URL=http://localhost:3000

# GitHub OAuth
AUTH_GITHUB_ID=your_github_id
AUTH_GITHUB_SECRET=your_github_secret

# Google OAuth
AUTH_GOOGLE_ID=your_google_id
AUTH_GOOGLE_SECRET=your_google_secret

# Database
DATABASE_URL="postgresql://..."
```

### 5. Types TypeScript

**`types/next-auth.d.ts`**

```typescript
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession["user"]
  }
  
  interface User {
    role: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
  }
}
```

## Utilisation Moderne

### Server Components

```typescript
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/login")
  }
  
  return (
    <div>
      <h1>Bienvenue {session.user.name}</h1>
      <p>Email: {session.user.email}</p>
      <p>Rôle: {session.user.role}</p>
    </div>
  )
}
```

### Client Components

```typescript
'use client'

import { useSession } from "next-auth/react"
import { SignInButton } from "@/components/auth/sign-in-button"
import { SignOutButton } from "@/components/auth/sign-out-button"

export function UserNav() {
  const { data: session, status } = useSession()
  
  if (status === "loading") {
    return <div>Chargement...</div>
  }
  
  if (!session) {
    return <SignInButton />
  }
  
  return (
    <div className="flex items-center gap-4">
      <img 
        src={session.user.image || "/default-avatar.png"} 
        alt={session.user.name || "User"}
        className="h-8 w-8 rounded-full"
      />
      <span>{session.user.name}</span>
      <SignOutButton />
    </div>
  )
}
```

### Boutons d'authentification

**`components/auth/sign-in-button.tsx`**

```typescript
'use client'

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Github, Mail } from "lucide-react"

export function SignInButton() {
  return (
    <div className="flex flex-col gap-3">
      <Button 
        onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
        variant="outline"
        className="w-full"
      >
        <Github className="mr-2 h-4 w-4" />
        Continuer avec GitHub
      </Button>
      
      <Button 
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        variant="outline"
        className="w-full"
      >
        <Mail className="mr-2 h-4 w-4" />
        Continuer avec Google
      </Button>
    </div>
  )
}
```

**`components/auth/sign-out-button.tsx`**

```typescript
'use client'

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  return (
    <Button 
      onClick={() => signOut({ callbackUrl: "/" })}
      variant="ghost"
      size="sm"
    >
      <LogOut className="mr-2 h-4 w-4" />
      Déconnexion
    </Button>
  )
}
```

### Middleware moderne

**`middleware.ts`**

```typescript
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth
  
  // Routes publiques
  const publicRoutes = ["/", "/login", "/register"]
  const isPublicRoute = publicRoutes.includes(pathname)
  
  // Redirection si non connecté sur route protégée
  if (!isLoggedIn && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.url))
  }
  
  // Redirection si connecté sur page login
  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }
  
  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

### Server Actions

```typescript
'use server'

import { auth, signIn, signOut } from "@/auth"
import { revalidatePath } from "next/cache"

export async function login(formData: FormData) {
  await signIn("credentials", formData)
}

export async function logout() {
  await signOut({ redirectTo: "/" })
}

export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

export async function updateProfile(data: { name: string }) {
  const session = await auth()
  
  if (!session?.user) {
    throw new Error("Non authentifié")
  }
  
  // Mise à jour en base
  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name }
  })
  
  revalidatePath("/profile")
}
```

### Page de login moderne

```typescript
'use client'

import { useState } from "react"
import { login } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    await login(formData)
    
    setLoading(false)
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 p-8">
        <h2 className="text-3xl font-bold">Connexion</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              name="email" 
              type="email" 
              required 
            />
          </div>
          
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input 
              id="password" 
              name="password" 
              type="password" 
              required 
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={loading}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Ou continuer avec
            </span>
          </div>
        </div>
        
        <SignInButton />
      </div>
    </div>
  )
}
```

Cette configuration moderne utilise Auth.js v5 avec les dernières fonctionnalités : Server Actions, App Router, TypeScript strict, et une architecture propre et maintenable.