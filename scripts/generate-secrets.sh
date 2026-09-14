#!/bin/bash

# Script to generate strong secrets for production use

echo "========================================="
echo "Security Secrets Generator"
echo "========================================="
echo ""

echo "Generating JWT_SECRET (64 bytes):"
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))")
echo "JWT_SECRET=$JWT_SECRET"
echo ""

echo "Generating JWT_REFRESH_SECRET (64 bytes):"
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('base64'))")
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo ""

echo "========================================="
echo "IMPORTANT: Copy these secrets to your .env file"
echo "Never commit these secrets to version control"
echo "========================================="
echo ""

# Save to file (optional)
read -p "Save to secrets.txt? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "JWT_SECRET=$JWT_SECRET" > secrets.txt
    echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET" >> secrets.txt
    echo "Secrets saved to secrets.txt"
    echo "Remember to delete this file after copying to .env!"
fi
