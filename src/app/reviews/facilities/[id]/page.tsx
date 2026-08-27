import type { Metadata } from "next";
import { FacilityReviewPage } from "@/components/public-details";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "어린이집 후기 모아보기 | 선생잎",
  description: "인증한 선생님들이 남긴 어린이집 근무 후기를 확인해 보세요.",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: Props) {
  return <FacilityReviewPage seedId={Number((await params).id)} />;
}
