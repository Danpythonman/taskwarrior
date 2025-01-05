#!/bin/bash

# Navigate to your repository
cd /home/daniel/.task || exit

# Check if there are changes
if [[ `git status --porcelain` ]]; then
    # Stage all changes
    git add -A

    # Commit with a timestamped message
    git commit -m "Automated commit: $(date +"%Y-%m-%d %H:%M:%S")"

    # Push to the remote repository
    git push
else
    echo "No changes to commit"
fi

