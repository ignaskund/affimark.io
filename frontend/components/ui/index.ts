// UI Component Library
// Import all components from this single file

// Core components
export { Button, buttonVariants, type ButtonProps } from './button';
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants, type CardProps } from './card';
export { Badge, badgeVariants, type BadgeProps } from './badge';
export { Input, type InputProps } from './input';
export { StatCard, type StatCardProps } from './stat-card';

// Loading & States
export {
    Skeleton,
    SkeletonCard,
    SkeletonStatCard,
    SkeletonDashboard,
    SkeletonTable,
    type SkeletonProps
} from './skeleton';
export {
    EmptyState,
    EmptyStateNoData,
    EmptyStateError,
    EmptyStateSearch,
    type EmptyStateProps
} from './empty-state';

// Error Handling
export { ErrorBoundary, ErrorFallback, withErrorBoundary } from './error-boundary';

// Existing shadcn components
export { Avatar, AvatarImage, AvatarFallback } from './avatar';
export { ScrollArea, ScrollBar } from './scroll-area';
export { Separator } from './separator';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs';
