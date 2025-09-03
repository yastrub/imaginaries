import * as React from "react";
import { cn } from "../../lib/utils";

// Simple RadioGroup component that manages the state internally
const RadioGroup = React.forwardRef(({ className, value, onValueChange, children, ...props }, ref) => {
  return (
    <div
      className={cn("grid gap-2", className)}
      ref={ref}
      {...props}
    >
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            checked: child.props.value === value,
            onChange: () => onValueChange(child.props.value)
          });
        }
        return child;
      })}
    </div>
  );
});
RadioGroup.displayName = "RadioGroup";

const RadioGroupItem = React.forwardRef(({ className, checked, onChange, value, id, children, ...props }, ref) => {
  return (
    <div className="flex items-center space-x-2">
      <input
        type="radio"
        ref={ref}
        id={id}
        checked={checked}
        onChange={onChange}
        value={value}
        className={cn(
          "h-4 w-4 rounded-full border-gray-300 text-primary focus:ring-primary",
          className
        )}
        {...props}
      />
      {children && <label htmlFor={id} className="text-sm cursor-pointer">{children}</label>}
    </div>
  );
});
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
