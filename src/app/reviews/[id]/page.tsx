import type { Metadata } from "next";
import { ReviewDetailPage } from "@/components/public-details";
import { contentMetadata } from "@/lib/content-metadata";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { return contentMetadata("reviews", Number((await params).id)); }
export default async function Page({ params }: Props) { return <ReviewDetailPage id={Number((await params).id)}/>; }
