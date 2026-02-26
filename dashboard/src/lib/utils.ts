import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getActionColor(action: string) {
  const colors: Record<string, string> = {
    show_products: "bg-chart-1/10 text-chart-1",
    ask_clarification: "bg-chart-3/10 text-chart-3",
    answer_question: "bg-chart-2/10 text-chart-2",
    empathize: "bg-chart-4/10 text-chart-4",
    greet: "bg-chart-5/10 text-chart-5",
    thank: "bg-chart-2/10 text-chart-2",
    handoff: "bg-destructive/10 text-destructive",
    human_reply: "bg-chart-5/10 text-chart-5",
    farewell: "bg-muted text-muted-foreground",
  };
  return colors[action] || "bg-muted text-muted-foreground";
}

export function maskPhone(phone: string) {
  if (phone.length >= 4) {
    return `•••${phone.slice(-4)}`;
  }
  return phone;
}
