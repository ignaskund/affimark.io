'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import PriorityOption from './PriorityOption';
import type { PriorityOption as PriorityOptionType, Priority } from '@/types/finder';

interface PriorityRankerProps {
  type: 'product' | 'brand';
  options: PriorityOptionType[];
  selected: Priority[];
  onSelectionChange: (selected: Priority[]) => void;
  maxSelections?: number;
}

// Sortable item wrapper
function SortableItem({
  option,
  rank,
  onRemove,
}: {
  option: PriorityOptionType;
  rank: number;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <PriorityOption
        option={option}
        isSelected={true}
        rank={rank}
        onSelect={onRemove}
        isDragging={isDragging}
        showDragHandle={true}
      />
    </div>
  );
}

export default function PriorityRanker({
  type,
  options,
  selected,
  onSelectionChange,
  maxSelections = 5,
}: PriorityRankerProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get selected option objects in ranked order
  const selectedOptions = selected
    .sort((a, b) => a.rank - b.rank)
    .map((s) => options.find((o) => o.id === s.id))
    .filter(Boolean) as PriorityOptionType[];

  // Get unselected options
  const unselectedOptions = options.filter(
    (o) => !selected.some((s) => s.id === o.id)
  );

  // Get the active item for drag overlay
  const activeOption = activeId ? options.find((o) => o.id === activeId) : null;

  // Handle selection toggle
  const handleToggle = useCallback(
    (optionId: string) => {
      const isSelected = selected.some((s) => s.id === optionId);

      if (isSelected) {
        // Remove and rerank
        const newSelected = selected
          .filter((s) => s.id !== optionId)
          .sort((a, b) => a.rank - b.rank)
          .map((s, index) => ({ ...s, rank: index + 1 }));
        onSelectionChange(newSelected);
      } else if (selected.length < maxSelections) {
        // Add with next rank
        onSelectionChange([
          ...selected,
          { id: optionId, rank: selected.length + 1 },
        ]);
      }
    },
    [selected, maxSelections, onSelectionChange]
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end (reorder)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = selected.findIndex((s) => s.id === active.id);
      const newIndex = selected.findIndex((s) => s.id === over.id);

      const reordered = arrayMove(selected, oldIndex, newIndex).map(
        (s, index) => ({ ...s, rank: index + 1 })
      );

      onSelectionChange(reordered);
    }
  };

  const title = type === 'product' ? 'Product Priorities' : 'Brand Priorities';
  const subtitle =
    type === 'product'
      ? 'What matters most when choosing products to promote?'
      : 'What matters most when choosing brands to work with?';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="text-gray-400 mt-2">{subtitle}</p>
        <p className="text-sm text-orange-400 mt-1">
          Select {maxSelections} priorities and drag to rank them
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Selected (Ranked) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Your Top {maxSelections}
            </h3>
            <span className="text-xs text-gray-500">
              {selected.length}/{maxSelections} selected
            </span>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={selectedOptions.map((o) => o.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 min-h-[320px] p-4 rounded-xl border-2 border-dashed border-gray-800 bg-gray-900/30">
                <AnimatePresence>
                  {selectedOptions.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center h-[280px] text-gray-500 text-sm"
                    >
                      Click options on the right to add them here
                    </motion.div>
                  ) : (
                    selectedOptions.map((option, index) => (
                      <SortableItem
                        key={option.id}
                        option={option}
                        rank={index + 1}
                        onRemove={() => handleToggle(option.id)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </SortableContext>

            {/* Drag overlay */}
            <DragOverlay>
              {activeOption ? (
                <PriorityOption
                  option={activeOption}
                  isSelected={true}
                  rank={selected.find((s) => s.id === activeOption.id)?.rank}
                  onSelect={() => {}}
                  isDragging={true}
                  showDragHandle={true}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Available Options */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            Available Options
          </h3>

          <div className="space-y-2">
            <AnimatePresence>
              {unselectedOptions.map((option) => (
                <motion.div
                  key={option.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <PriorityOption
                    option={option}
                    isSelected={false}
                    onSelect={() => handleToggle(option.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {unselectedOptions.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center h-32 text-gray-500 text-sm"
              >
                All options selected
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-1.5">
        {Array.from({ length: maxSelections }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i < selected.length ? 'bg-orange-500' : 'bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
