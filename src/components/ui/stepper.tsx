
import React from 'react';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepperProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn("flex items-center justify-between w-full mb-8", className)}>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;
        
        return (
          <div key={index} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200",
                  (isCompleted || isActive) ? "bg-blue-600 border-blue-600 text-white" : "bg-slate-800 border-slate-600 text-slate-400"
                )}
              >
                {isCompleted ? (
                  <Check size={16} />
                ) : (
                  <Circle size={16} fill="currentColor" />
                )}
              </div>
              
              {/* Step Label */}
              <span
                className={cn(
                  "mt-2 text-xs font-medium transition-colors duration-200",
                  (isActive || isCompleted) ? "text-blue-400" : "text-slate-400"
                )}
              >
                {step}
              </span>
            </div>
            
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-16 mx-4 transition-colors duration-200",
                  stepNumber < currentStep ? "bg-blue-600" : "bg-slate-600"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
