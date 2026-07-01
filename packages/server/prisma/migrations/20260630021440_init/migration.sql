-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `openid` VARCHAR(64) NOT NULL,
    `unionid` VARCHAR(64) NULL,
    `nickname` VARCHAR(64) NULL,
    `avatarUrl` VARCHAR(512) NULL,
    `phone` VARCHAR(20) NULL,
    `phoneRaw` VARCHAR(64) NULL,
    `familyId` BIGINT UNSIGNED NULL,
    `status` TINYINT NOT NULL DEFAULT 1,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_openid_key`(`openid`),
    INDEX `users_familyId_idx`(`familyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plans` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `userId` BIGINT UNSIGNED NOT NULL,
    `familyId` BIGINT UNSIGNED NULL,
    `name` VARCHAR(64) NOT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'custom',
    `color` VARCHAR(16) NOT NULL DEFAULT '#007AFF',
    `totalCount` INTEGER UNSIGNED NULL,
    `initialDoneCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `doneCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `missedCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `absenceConsumes` BOOLEAN NOT NULL DEFAULT false,
    `timeMode` VARCHAR(10) NOT NULL DEFAULT 'fixed',
    `scheduleConfig` JSON NULL,
    `overdueHandling` VARCHAR(16) NOT NULL DEFAULT 'keep_pending',
    `overdueGraceHours` INTEGER UNSIGNED NOT NULL DEFAULT 24,
    `recordValue` BOOLEAN NOT NULL DEFAULT false,
    `valueUnit` VARCHAR(16) NULL,
    `startDate` DATE NULL,
    `endDate` DATE NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'active',
    `remark` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `plans_userId_status_idx`(`userId`, `status`),
    INDEX `plans_userId_type_idx`(`userId`, `type`),
    INDEX `plans_familyId_idx`(`familyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checkins` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `planId` BIGINT UNSIGNED NOT NULL,
    `userId` BIGINT UNSIGNED NOT NULL,
    `memberId` BIGINT UNSIGNED NULL,
    `scheduledDate` DATE NOT NULL,
    `scheduledTime` VARCHAR(8) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `actualTime` DATETIME(3) NULL,
    `value` DECIMAL(10, 2) NULL,
    `remark` VARCHAR(255) NULL,
    `source` VARCHAR(16) NOT NULL DEFAULT 'scheduled',
    `adjustmentType` VARCHAR(16) NULL,
    `originalScheduledDate` DATE NULL,
    `originalScheduledTime` VARCHAR(8) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `checkins_planId_scheduledDate_idx`(`planId`, `scheduledDate`),
    INDEX `checkins_userId_status_idx`(`userId`, `status`),
    INDEX `checkins_status_scheduledDate_idx`(`status`, `scheduledDate`),
    UNIQUE INDEX `checkins_planId_scheduledDate_scheduledTime_key`(`planId`, `scheduledDate`, `scheduledTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `plans` ADD CONSTRAINT `plans_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checkins` ADD CONSTRAINT `checkins_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
