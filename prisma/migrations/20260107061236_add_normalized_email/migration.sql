/*
  Warnings:

  - A unique constraint covering the columns `[normalizedEmail]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "normalizedEmail" TEXT;

