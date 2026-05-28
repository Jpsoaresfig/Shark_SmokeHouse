import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "white" | "black";
  size?: "sm" | "md" | "lg" | "xl";
  asLink?: boolean;
  className?: string;
}

const sizes = {
  sm: 64,
  md: 88,
  lg: 116,
  xl: 148,
};

export function Logo({
  variant = "black",
  size = "md",
  asLink = true,
  className,
}: LogoProps) {
  const px = sizes[size];
  const src =
    variant === "white"
      ? "/logo_shark_branca.jpeg"
      : "/logo_shark_preta.jpeg";

  const img = (
    <div
      className={cn("rounded-full overflow-hidden shrink-0", className)}
      style={{ width: px, height: px }}
    >
      <Image
        src={src}
        alt="Shark SmokeHouse"
        width={px}
        height={px}
        className="object-cover w-full h-full"
        priority
      />
    </div>
  );

  if (!asLink) return img;

  return (
    <Link href="/" className="inline-flex items-center shrink-0">
      {img}
    </Link>
  );
}
