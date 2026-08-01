import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  className?: string;
  inverted?: boolean;
};

export function BrandLogo({ className = "", inverted = false }: BrandLogoProps) {
  return (
    <Link href="/" aria-label="Coursely AI home" className={`relative block h-9 w-36 shrink-0 overflow-hidden ${className}`}>
      <Image src="/brand/coursely-ai-logo-transparent.png" alt="Coursely AI" fill priority sizes="144px" className={`object-cover ${inverted ? "invert" : ""}`} />
    </Link>
  );
}
