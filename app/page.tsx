'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Play, 
  Square, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Terminal, 
  Star, 
  StarOff, 
  History, 
  Trash2,
  Copy,
  Settings,
  Bell,
  User,
  Zap
} from 'lucide-react';

interface ResponseMessage {
  id: string;
  content: string;
  timestamp: Date;
  isComplete: boolean;
}

interface StoredPrompt {
  id: string;
  content: string;
  timestamp: Date;
  isFavorite: boolean;
}

type TestStatus = 'idle' | 'running' | 'success' | 'failure';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ResponseMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [recentPrompts, setRecentPrompts] = useState<StoredPrompt[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Check for success/failure indicators
    if(messages?.length > 0){
      console.log(messages[messages.length - 1]);
      const lowerData = messages[messages.length - 1]?.content?.toLowerCase();
      if (lowerData.includes('test is success')) {
        setTestStatus('success');
        setIsRunning(false);
        eventSourceRef.current?.close();
      } else if (lowerData.includes('test is fail')) {
        setTestStatus('failure');
        setIsRunning(false);
        eventSourceRef.current?.close();
      }
    }
  }, [messages]);

  const examplePrompt = `Proceed step by step:
1. Navigate to 'https://www.turkishairlines.com'
2. Click I accept cookies button
2. Search flights from 'Istanbul' to 'Ankara' on 'June 25'
`;

  // Load recent prompts from localStorage on component mount
  useEffect(() => {
    const stored = localStorage.getItem('ai-automation-prompts');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const prompts = parsed.map((p: any) => ({
          ...p,
          timestamp: new Date(p.timestamp)
        }));
        setRecentPrompts(prompts);
      } catch (error) {
        console.error('Error loading stored prompts:', error);
      }
    }
  }, []);

  // Save prompts to localStorage whenever recentPrompts changes
  useEffect(() => {
    if (recentPrompts.length > 0) {
      localStorage.setItem('ai-automation-prompts', JSON.stringify(recentPrompts));
    }
  }, [recentPrompts]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const addMessage = (content: string) => {
    const cleanContent = content.replace(/\\u0020/g, " ");
    setCurrentMessage(prevCurrent => {
      const newCurrent = prevCurrent + cleanContent;
      setMessages(prevMessages => {
        if (prevMessages.length === 0) {
          return [{
            id: '1',
            content: newCurrent,
            timestamp: new Date(),
            isComplete: false
          }];
        }
        const newMessages = [...prevMessages];
        newMessages[0] = {
          ...newMessages[0],
          content: newCurrent
        };
        return newMessages;
      });
      return newCurrent;
    });
    setTimeout(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, 100);
  };

  const savePromptToHistory = (promptText: string) => {
    const newPrompt: StoredPrompt = {
      id: Date.now().toString(),
      content: promptText,
      timestamp: new Date(),
      isFavorite: false
    };

    setRecentPrompts(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(p => p.content !== promptText);
      // Add new prompt at the beginning and limit to 50 items
      return [newPrompt, ...filtered].slice(0, 50);
    });
  };

  const toggleFavorite = (promptId: string) => {
    setRecentPrompts(prev => 
      prev.map(p => 
        p.id === promptId ? { ...p, isFavorite: !p.isFavorite } : p
      )
    );
  };

  const deletePrompt = (promptId: string) => {
    setRecentPrompts(prev => prev.filter(p => p.id !== promptId));
  };

  const loadPrompt = (promptContent: string) => {
    setPrompt(promptContent);
  };

  const copyPrompt = (promptContent: string) => {
    navigator.clipboard.writeText(promptContent);
  };

  const handleRunTest = async () => {
    if (!prompt.trim() || isRunning) return;

    savePromptToHistory(prompt);
    setIsRunning(true);
    setTestStatus('running');
    setMessages([]);
    setCurrentMessage('');

    const encodedPrompt = encodeURIComponent(prompt);
    const url = `${apiBaseUrl}/api/v1/prompts?prompt=${encodedPrompt}`;

    try {
      eventSourceRef.current = new EventSource(url);

      eventSourceRef.current.onmessage = (event) => {
        const data = event.data;
        addMessage(data);
      };

      eventSourceRef.current.onerror = (error) => {
        console.error('EventSource error:', error);
        addMessage('Error: Connection to server failed');
        setTestStatus('failure');
        setIsRunning(false);
        eventSourceRef.current?.close();
      };

      eventSourceRef.current.onopen = () => {
        addMessage('Connected to server, starting test...\n');
      };

    } catch (error) {
      console.error('Error starting test:', error);
      addMessage('\nError: Failed to start test');
      setTestStatus('failure');
      setIsRunning(false);
    }
  };

  const handleStopTest = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRunning(false);
    setTestStatus('idle');
    addMessage('Test stopped by user');
  };

  const getStatusBadge = () => {
    switch (testStatus) {
      case 'running':
        return (
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Running
          </Badge>
        );
      case 'success':
        return (
          <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Success
          </Badge>
        );
      case 'failure':
        return (
          <Badge variant="secondary" className="bg-red-500/20 text-red-300 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-muted-foreground/30">
            <Terminal className="w-3 h-3 mr-1" />
            Ready
          </Badge>
        );
    }
  };

  const favoritePrompts = recentPrompts.filter(p => p.isFavorite);
  const nonFavoritePrompts = recentPrompts.filter(p => !p.isFavorite);

  const PromptItem = ({ prompt: storedPrompt }: { prompt: StoredPrompt }) => (
    <div className="group p-3 rounded-lg border border-border/30 bg-background/30 hover:bg-background/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-foreground/90 line-clamp-2 cursor-pointer hover:text-foreground"
             onClick={() => loadPrompt(storedPrompt.content)}>
            {storedPrompt.content}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {storedPrompt.timestamp.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => toggleFavorite(storedPrompt.id)}
                >
                  {storedPrompt.isFavorite ? (
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  ) : (
                    <StarOff className="w-3 h-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {storedPrompt.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => copyPrompt(storedPrompt.content)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Copy prompt
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                  onClick={() => deletePrompt(storedPrompt.id)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Delete prompt
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Left side - Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  AI Automation
                </h1>
              </div>
            </div>
          </div>

          {/* Right side - User actions */}
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                    <Bell className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Notifications
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                    <Settings className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Settings
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                  JD
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block">
                <p className="text-sm font-medium">John Doe</p>
                <p className="text-xs text-muted-foreground">Developer</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Left Sidebar - Prompt History */}
        <aside className="w-80 h-screen bg-card/50 backdrop-blur border-r border-border/50 flex flex-col">
          <div className="p-6 border-b border-border/30">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5" />
              Prompt History
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your automation prompts
            </p>
          </div>

          <div className="flex-1 p-6">
            <Tabs defaultValue="recent" className="w-full h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="recent" className="text-xs">
                  Recent ({nonFavoritePrompts.length})
                </TabsTrigger>
                <TabsTrigger value="favorites" className="text-xs">
                  Favorites ({favoritePrompts.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="recent" className="flex-1 mt-0">
                <ScrollArea className="h-full pr-4">
                  {nonFavoritePrompts.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                      <History className="w-12 h-12 mx-auto opacity-50 mb-4" />
                      <p className="text-sm font-medium">No recent prompts</p>
                      <p className="text-xs mt-1">Run a test to see history</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {nonFavoritePrompts.map((storedPrompt) => (
                        <PromptItem key={storedPrompt.id} prompt={storedPrompt} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="favorites" className="flex-1 mt-0">
                <ScrollArea className="h-full pr-4">
                  {favoritePrompts.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                      <Star className="w-12 h-12 mx-auto opacity-50 mb-4" />
                      <p className="text-sm font-medium">No favorite prompts</p>
                      <p className="text-xs mt-1">Star prompts to save them here</p>
                    </div>
                  )}
                  {favoritePrompts.length > 0 && (
                    <div className="space-y-3">
                      {favoritePrompts.map((storedPrompt) => (
                        <PromptItem key={storedPrompt.id} prompt={storedPrompt} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 space-y-6 overflow-auto h-screen">
          {/* Welcome Section */}
          <div className="text-center space-y-2 py-4">
            <h2 className="text-3xl font-bold text-foreground">
              Automation Testing Dashboard
            </h2>
            <p className="text-muted-foreground">
              Send automation prompts and monitor real-time execution
            </p>
          </div>

          {/* Input Section */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Test Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="prompt" className="text-sm font-medium">
                  Automation Prompt
                </label>
                <Textarea
                  id="prompt"
                  placeholder={examplePrompt}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[200px] bg-background/50 border-border/50 resize-none font-mono text-sm"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusBadge()}
                  <span className="text-xs text-muted-foreground">
                    {messages.length} messages
                  </span>
                </div>
                
                <div className="flex gap-2">
                  {isRunning ? (
                    <Button 
                      onClick={handleStopTest}
                      variant="destructive"
                      size="sm"
                    >
                      <Square className="w-4 h-4 mr-2" />
                      Stop Test
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleRunTest}
                      disabled={!prompt.trim()}
                      size="sm"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Run Test
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Response Section */}
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Real-time Response
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea 
                ref={scrollAreaRef}
                className="h-[400px] w-full rounded-md border border-border/50 bg-background/30 p-4"
              >
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center space-y-2">
                      <Terminal className="w-8 h-8 mx-auto opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-xs">Run a test to see real-time responses</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message, index) => (
                      <div key={message.id} className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                          <span className="text-blue-400">Response</span>
                        </div>
                        <div className="bg-background/50 rounded-md p-3 border border-border/30">
                          <p className="text-sm font-mono whitespace-pre-wrap break-words">
                            {message.content}
                            {!message.isComplete && (
                              <span className="inline-block w-2 h-4 ml-1 bg-foreground/50 animate-pulse" />
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
