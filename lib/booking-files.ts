import type { Prisma } from "@prisma/client";

/**
 * Error thrown when validating or linking uploaded booking files to a revision or dispute.
 */
export class AttachmentLinkError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "AttachmentLinkError";
    this.code = code;
    this.status = status;
  }
}

export interface LinkBookingAttachmentsInput {
  bookingId: string;
  userId: string;
  isAdmin: boolean;
  fileIds: string[];
  targetType: "revision" | "dispute";
  targetId: string;
}

/**
 * Verifies booking membership, uploader ownership, and exclusive attachment state,
 * then atomically links the booking files to a revision or dispute within a transaction.
 */
export async function linkBookingAttachmentsInTx(
  tx: Prisma.TransactionClient,
  input: LinkBookingAttachmentsInput
): Promise<void> {
  const uniqueFileIds = [...new Set(input.fileIds)];
  if (uniqueFileIds.length === 0) return;

  const files = await tx.bookingFile.findMany({
    where: { id: { in: uniqueFileIds } },
    select: {
      id: true,
      bookingId: true,
      uploaderId: true,
      revisionId: true,
      disputeId: true,
    },
  });
  const fileMap = new Map(files.map((f) => [f.id, f]));

  for (const fileId of uniqueFileIds) {
    const file = fileMap.get(fileId);
    if (!file || file.bookingId !== input.bookingId) {
      throw new AttachmentLinkError(
        "INVALID_ATTACHMENT_FILE",
        "One or more attachment files do not belong to this booking.",
        400
      );
    }
    if (!input.isAdmin && file.uploaderId !== input.userId) {
      throw new AttachmentLinkError(
        "FORBIDDEN",
        "You can only attach files that you uploaded.",
        403
      );
    }

    const conflictingOtherLink =
      input.targetType === "revision" ? file.disputeId : file.revisionId;
    const existingTargetLink =
      input.targetType === "revision" ? file.revisionId : file.disputeId;
    if (
      conflictingOtherLink ||
      (existingTargetLink && existingTargetLink !== input.targetId)
    ) {
      throw new AttachmentLinkError(
        "ATTACHMENT_ALREADY_LINKED",
        "One or more attachment files are already linked to another revision or dispute.",
        409
      );
    }
  }

  const targetWhere: Prisma.BookingFileWhereInput =
    input.targetType === "revision"
      ? {
          OR: [{ revisionId: null }, { revisionId: input.targetId }],
          disputeId: null,
        }
      : {
          revisionId: null,
          OR: [{ disputeId: null }, { disputeId: input.targetId }],
        };

  const linked = await tx.bookingFile.updateMany({
    where: {
      id: { in: uniqueFileIds },
      bookingId: input.bookingId,
      ...targetWhere,
      ...(input.isAdmin ? {} : { uploaderId: input.userId }),
    },
    data:
      input.targetType === "revision"
        ? { revisionId: input.targetId }
        : { disputeId: input.targetId },
  });

  if (linked.count !== uniqueFileIds.length) {
    throw new AttachmentLinkError(
      "ATTACHMENT_ALREADY_LINKED",
      `One or more attachment files could not be linked to this ${input.targetType}.`,
      409
    );
  }
}
