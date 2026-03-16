import * as React from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SelectTriggerProps = React.ComponentProps<typeof SelectTrigger>;
type SelectContentProps = React.ComponentProps<typeof SelectContent>;
type SelectItemProps = React.ComponentProps<typeof SelectItem>;

function AdminSelectTrigger({ className, ...props }: SelectTriggerProps) {
    return (
        <SelectTrigger
            className={cn(
                'h-10 w-full rounded-lg border-gray-200 bg-white text-sm text-gray-900 shadow-sm',
                'data-placeholder:text-gray-500',
                className,
            )}
            {...props}
        />
    );
}

function AdminSelectContent({ className, position = 'popper', ...props }: SelectContentProps) {
    return (
        <SelectContent
            position={position}
            className={cn(
                'z-[1200] rounded-lg border border-gray-200 bg-white text-gray-900 shadow-lg',
                className,
            )}
            {...props}
        />
    );
}

function AdminSelectItem({ className, ...props }: SelectItemProps) {
    return (
        <SelectItem
            className={cn(
                'py-2 text-sm text-gray-700 focus:bg-blue-50 focus:text-blue-700',
                'data-[state=checked]:bg-blue-50 data-[state=checked]:text-blue-700',
                className,
            )}
            {...props}
        />
    );
}

export {
    Select as AdminSelect,
    SelectValue as AdminSelectValue,
    AdminSelectTrigger,
    AdminSelectContent,
    AdminSelectItem,
};
