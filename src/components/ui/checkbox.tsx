import * as React from "react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      "size-4 cursor-pointer rounded border border-input bg-background text-primary accent-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
      className,
    )}
    {...props}
  />
));
Checkbox.displayName = "Checkbox";
