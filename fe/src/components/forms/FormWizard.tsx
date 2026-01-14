"use client";

import * as React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormGenerator, FormSchema } from "./FormGenerator";
import { FormField } from "./FormField";
import { FormActions } from "./FormActions";
import { Button } from "@/components/ui/button";
import { ProgressIndicator } from "@/components/utilities/ProgressIndicator";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  schema: FormSchema;
  validation?: z.ZodSchema;
}

export interface FormWizardProps {
  steps: WizardStep[];
  onComplete: (values: Record<string, any>) => void | Promise<void>;
  onStepChange?: (step: number) => void;
  allowJump?: boolean;
  showSummary?: boolean;
  className?: string;
}

export function FormWizard({
  steps,
  onComplete,
  onStepChange,
  allowJump = false,
  showSummary = true,
  className,
}: FormWizardProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set());
  const [formData, setFormData] = React.useState<Record<string, any>>({});

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = async (stepValues: Record<string, any>) => {
    setFormData((prev) => ({ ...prev, ...stepValues }));
    setCompletedSteps((prev) => new Set(prev).add(currentStep));

    if (isLastStep) {
      // All steps completed, submit final form
      const finalData = { ...formData, ...stepValues };
      await onComplete(finalData);
    } else {
      // Move to next step
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      onStepChange?.(nextStep);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      onStepChange?.(prevStep);
    }
  };

  const handleStepClick = (stepIndex: number) => {
    if (!allowJump) return;
    if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
      setCurrentStep(stepIndex);
      onStepChange?.(stepIndex);
    }
  };

  const stepForm = useForm({
    resolver: currentStepData.validation ? zodResolver(currentStepData.validation) : undefined,
    defaultValues: formData,
    mode: "onChange",
  });

  const handleStepSubmit = async (values: Record<string, any>) => {
    await handleNext(values);
  };

  return (
    <FormProvider {...stepForm}>
      <div className={cn("space-y-6", className)}>
        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-slate-600">{Math.round(progress)}%</span>
          </div>
          <ProgressIndicator value={currentStep + 1} max={steps.length} showPercentage={false} />
        </div>

        {/* Step Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => handleStepClick(index)}
                disabled={!allowJump && index > currentStep && !completedSteps.has(index)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : completedSteps.has(index)
                    ? "bg-muted text-foreground"
                    : "bg-background text-slate-600",
                  !allowJump && index > currentStep && !completedSteps.has(index) && "opacity-50 cursor-not-allowed"
                )}
              >
                {index + 1}. {step.title}
              </button>
            ))}
          </div>
        </div>

        {/* Current Step Content */}
        <form
          onSubmit={stepForm.handleSubmit(handleStepSubmit)}
          className="border rounded-lg p-6 space-y-6"
        >
          <div>
            <h2 className="text-2xl font-semibold">{currentStepData.title}</h2>
            {currentStepData.description && (
              <p className="text-slate-600 mt-2">{currentStepData.description}</p>
            )}
          </div>

          <div className="space-y-4">
            {Object.entries(currentStepData.schema).map(([key, field]) => (
              <FormField
                key={key}
                name={key}
                type={field.type}
                label={field.label}
                placeholder={field.placeholder}
                helpText={field.helpText}
                validation={field.validation}
                conditional={field.conditional}
                options={field.options}
                disabled={field.disabled}
                render={field.render}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button type="submit" disabled={stepForm.formState.isSubmitting}>
              {stepForm.formState.isSubmitting
                ? "Processing..."
                : isLastStep
                ? "Complete"
                : "Next"}
              {!isLastStep && !stepForm.formState.isSubmitting && (
                <ChevronRight className="h-4 w-4 ml-2" />
              )}
            </Button>
          </div>
        </form>

        {/* Summary (optional, shown on last step) */}
        {showSummary && isLastStep && Object.keys(formData).length > 0 && (
          <div className="border rounded-lg p-6 bg-muted/50">
            <h3 className="font-semibold mb-4">Summary</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(formData).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-slate-600">{key}:</span>
                  <span className="font-medium text-slate-900">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FormProvider>
  );
}

