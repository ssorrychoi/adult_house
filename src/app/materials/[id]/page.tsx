import type { Metadata } from "next";
import { PostDetailPage } from "@/components/public-details";
import { contentMetadata } from "@/lib/content-metadata";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> { return contentMetadata("materials", Number((await params).id)); }
export default async function Page({ params }: Props) { return <PostDetailPage id={Number((await params).id)} material/>; }
