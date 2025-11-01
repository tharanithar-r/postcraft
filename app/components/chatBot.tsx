"use client"

import { useState, useRef, useEffect } from "react"
import { Plus, Trash2, Send, MessageSquare } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface Chat {
  id: string
  title: string
  messages: Message[]
}

export default function ChatBot() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentChat = chats.find((c) => c.id === currentChatId)

  const newChat = () => {
    const id = Date.now().toString()
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

  const sendMessage = () => {
    if (!input.trim() || !currentChatId) return

    const updatedChats = chats.map((chat) => {
      if (chat.id === currentChatId) {
        const userMessage: Message = { role: "user", content: input }
        const assistantMessage: Message = {
          role: "assistant",
          content: "This is a template response. Connect to your AI API here.",
        }
        return {
          ...chat,
          title: chat.title === "New Chat" ? input.slice(0, 30) : chat.title,
          messages: [...chat.messages, userMessage, assistantMessage],
        }
      }
      return chat
    })
    setChats(updatedChats)
    setInput("")
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentChat?.messages])
  useEffect(() => {
    newChat()
  }, [])
  

  return (
    <div className="flex h-screen bg-linear-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Sidebar */}
      <div className="w-72 bg-white/80 backdrop-blur-sm border-r border-emerald-100 p-4 flex flex-col shadow-lg">
        <button
          onClick={newChat}
          className="w-full cursor-pointer mb-6 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all shadow-md"
        >
          <Plus className="w-4 h-4" /> New Chat
        </button>
        
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group p-3 rounded-lg cursor-pointer transition-all ${
                currentChatId === chat.id
                  ? "bg-linear-to-r from-emerald-500 to-teal-600 text-white shadow-md"
                  : "bg-emerald-50/50 hover:bg-emerald-100/70 text-slate-700"
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
                  <div className="inline-flex p-3 bg-linear-to-br from-emerald-400 to-teal-500 rounded-full shadow-lg">
                    <MessageSquare className="w-12 h-12 text-white" />
                  </div>
                  <p className="text-slate-600 text-lg">Start a conversation</p>
                </div>
              </div>
            ) : (
              <>
                {currentChat.messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-md ${
                        msg.role === "user"
                          ? "bg-linear-to-r from-emerald-500 to-teal-600 text-white rounded-br-sm"
                          : "bg-white text-slate-700 rounded-bl-sm border border-emerald-100"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-emerald-100 bg-white/80 backdrop-blur-sm p-4 shadow-lg">
            <div className="flex gap-3 max-w-4xl mx-auto">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 rounded-lg bg-emerald-50/50 border border-emerald-200 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
              <button
                onClick={sendMessage}
                className="px-6 py-3 bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium rounded-lg transition-all transform hover:scale-105 shadow-md flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}