"use client";

import { useState, useCallback } from "react";

export interface OnePagerViewModelProps {
  initialExpanded?: boolean;
  collapsedSize?: {
    width?: string;
    height?: string;
  };
  expandedSize?: {
    width?: string;
    height?: string;
  };
  position?: {
    top?: string;
    left?: string;
    right?: string;
    bottom?: string;
  };
}

export function useOnePagerViewModel(props: OnePagerViewModelProps = {}) {
  const {
    initialExpanded = false,
    collapsedSize = { width: "w-full", height: "h-full" },
    expandedSize = { width: "90vw", height: "90vh" },
    position = {},
  } = props;

  const [isExpanded, setIsExpanded] = useState<boolean>(initialExpanded);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const expand = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsExpanded(true);
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating]);

  const collapse = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIsExpanded(false);
    setTimeout(() => setIsAnimating(false), 300);
  }, [isAnimating]);

  const toggle = useCallback(() => {
    if (isExpanded) {
      collapse();
    } else {
      expand();
    }
  }, [isExpanded, expand, collapse]);

  const currentSize = isExpanded ? expandedSize : collapsedSize;

  const containerStyle = {
    width: currentSize.width,
    height: currentSize.height,
    ...position,
  };

  return {
    isExpanded,
    isAnimating,
    currentSize,
    containerStyle,

    expand,
    collapse,
    toggle,

    collapsedSize,
    expandedSize,
    position,
  };
}
