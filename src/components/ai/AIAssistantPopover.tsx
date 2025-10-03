import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { AIAssistant } from "./AIAssistant";

export function AIAssistantPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:scale-110 transition-transform z-50"
          size="icon"
        >
          <Sparkles className="h-7 w-7 animate-pulse" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 mr-6 mb-2 p-0 border-none shadow-2xl rounded-xl">
        <AIAssistant />
      </PopoverContent>
    </Popover>
  );
}
