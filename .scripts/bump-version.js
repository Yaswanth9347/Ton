const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Target package.json files to keep in sync
const frontendPath = path.join(__dirname, '../frontend/package.json');
const backendPath = path.join(__dirname, '../backend/package.json');

function getCurrentVersion() {
    const pkg = JSON.parse(fs.readFileSync(frontendPath, 'utf8'));
    return pkg.version;
}

function updateVersion(newVersion) {
    [frontendPath, backendPath].forEach(p => {
        if (!fs.existsSync(p)) return;
        const pkg = JSON.parse(fs.readFileSync(p, 'utf8'));
        pkg.version = newVersion;
        fs.writeFileSync(p, JSON.stringify(pkg, null, 4) + '\n');
        console.log(`Updated ${path.relative(path.join(__dirname, '..'), p)} to version ${newVersion}`);
    });
}

function getCommitMessage() {
    try {
        // Gets the commit message of the most recent commit
        return execSync('git log -1 --pretty=%B').toString().trim();
    } catch (e) {
        console.warn("Failed to read git history, defaulting to patch");
        return "chore: init";
    }
}

function bumpVersion(version, type) {
    let [major, minor, patch] = version.split('.').map(Number);

    if (type === 'MAJOR') {
        major += 1;
        minor = 0;
        patch = 0;
    } else if (type === 'MINOR') {
        minor += 1;
        patch = 0;
    } else { // PATCH
        patch += 1;
    }

    return `${major}.${minor}.${patch}`;
}

function determineBumpType(msg) {
    const m = msg.toLowerCase();

    // Check if it's a merge commit, usually look at PR title if squashed, standard merges just fall back to PATCH unless specified explicitly
    if (m.startsWith('merge pull request')) return 'MINOR';

    if (m.startsWith('feat:') || m.startsWith('feat(') || m.includes('BREAKING CHANGE')) {
        return 'MAJOR';
    }

    if (m.startsWith('fix:') || m.startsWith('fix(') || m.startsWith('refactor:') || m.startsWith('refactor(') || m.startsWith('perf:') || m.startsWith('perf(')) {
        return 'MINOR';
    }

    // Default fallback for docs, chore, ui, style, test, etc.
    return 'PATCH';
}

function main() {
    console.log("Starting automated semantic version bump...");

    const currentVersion = getCurrentVersion();
    console.log(`Current version: ${currentVersion}`);

    const msg = getCommitMessage();
    console.log(`Latest commit message: "${msg.split('\n')[0]}"`);

    // Prevent infinite loops if the commit was already made by the bot
    if (msg.includes('[skip ci]') || msg.toLowerCase().includes('auto-bump version')) {
        console.log("Commit was an automated version bump. Skipping to prevent loop.");
        return;
    }

    const bumpType = determineBumpType(msg);
    console.log(`Deduced bump type: ${bumpType}`);

    const newVersion = bumpVersion(currentVersion, bumpType);
    console.log(`Bumping to version: ${newVersion}`);

    updateVersion(newVersion);
    console.log("Successfully wrote modified package.json files.");
}

main();
