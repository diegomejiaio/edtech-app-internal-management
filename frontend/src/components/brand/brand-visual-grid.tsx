"use client";

import Image from "next/image";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StaggerList } from "@/components/motion";

export interface BrandVisualCard {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
}

interface BrandVisualGridProps {
  title: string;
  description: string;
  items: BrandVisualCard[];
}

export function BrandVisualGrid({
  title,
  description,
  items,
}: BrandVisualGridProps) {
  const cards = items.map((item) => (
    <Card key={item.imageSrc} className="overflow-hidden py-0">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Image
          src={item.imageSrc}
          alt={item.imageAlt}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <CardHeader className="px-4 py-4">
        <CardTitle className="text-base">{item.title}</CardTitle>
        <CardDescription>{item.description}</CardDescription>
      </CardHeader>
    </Card>
  ));

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {cards.length > 1 ? (
        <StaggerList
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          staggerDelay={0.08}
        >
          {cards}
        </StaggerList>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards}
        </div>
      )}
    </section>
  );
}
