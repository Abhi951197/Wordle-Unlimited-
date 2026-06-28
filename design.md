# Wordle Unlimited - UI/UX Design Specification

Version: 1.0

Purpose:
This document defines the visual design system and screen specifications required to recreate the mobile application shown in the design reference.

This is a UI implementation guide, not a backend or product requirements document.

---

# Design Philosophy

The application should feel:

- Modern
- Minimal
- Premium
- Fast
- Dark themed
- Mobile-first
- Easy to use with one hand
- Similar quality to Discord + Spotify + Wordle

Every screen should maintain visual consistency.

---

# Primary Theme

Mode

- Dark Mode Only (MVP)

Background

#0B0F14

Secondary Background

#141A22

Card

#1B2430

Borders

#2A3544

Primary Accent

#4CAF50

Secondary Accent

#8B5CF6

Danger

#EF4444

Warning

#F59E0B

Text Primary

#FFFFFF

Text Secondary

#A7B0BE

Disabled

#6B7280

---

# Typography

Heading

Font Weight

700

Large

28px

Medium Heading

22px

Sub Heading

18px

Body

16px

Caption

13px

Use a clean sans-serif font.

Recommended:

- Inter
- SF Pro Display
- Manrope

---

# Border Radius

Buttons

14px

Cards

18px

Bottom Sheets

24px

Game Tiles

8px

Input Fields

12px

---

# Shadows

Very soft.

Do not use heavy shadows.

Elevation should be created mostly using contrast instead of blur.

---

# Global Layout

Safe Area

Always respect device safe area.

Horizontal Padding

20px

Vertical Spacing

16px

Screen Max Width

100%

---

# Landing Screen

Purpose

Allow the user to immediately start playing.

Layout

Top

Logo

Middle

App Title

Subtitle

Buttons

Bottom

Navigation

Buttons

Primary

Play Solo

Secondary

Create Party

Outlined

Join Party

Footer

How it Works

Stats

Settings

---

# Button Design

Height

56px

Radius

14px

Primary

Green Filled

Secondary

Purple Filled

Outlined

Transparent

Border

1px

Animation

Scale 0.98 on tap

---

# Choose Mode Screen

Two large cards.

Card 1

Play Together

Description

One shared board.

Everyone types together.

Card 2

Play Individually

Description

Everyone has their own puzzle.

Cards should have

Icon

Title

Description

Arrow

Hover Animation

Slight elevation

---

# Create Party Screen

Fields

Room Name

Difficulty

Player Count

Primary Button

Create Party

Bottom Text

"You will be the host"

All fields should be inside one rounded card.

---

# Lobby Screen

Header

Room Code

Copy Button

Settings Button

Middle

Player List

Each Player Item

Avatar

Username

Online Indicator

Host Badge

Bottom

Start Game

Leave Room

---

# Voice Chat Screen

Top

Room Name

Timer

Signal Strength

Center

Circular Avatars

Speaking users should animate.

Bottom Controls

Microphone

Mute

Camera Placeholder

Leave Call

Settings

Voice status

Connected

Muted

Speaking

Disconnected

---

# Shared Board Screen (Scenario 1)

Important Rule

There is only ONE board.

All connected players view the exact same board.

There are no individual boards.

Any player can:

- Type letters
- Delete letters
- Submit guesses
- Continue another player's guess
- Finish a partially typed word

Changes should appear instantly for everyone.

The board must always remain synchronized.

Layout

Header

Room Name

Players Button

Menu

Center

Wordle Grid

Keyboard

Bottom

Player Activity

Voice Controls

Mute Button

No player ownership exists.

The board belongs to the room.

---

# Solo Mode

Exactly like traditional Wordle.

No voice controls.

No multiplayer UI.

No player list.

No room code.

No LiveKit connection.

Keep interface clean.

---

# Individual Multiplayer Mode

Each player has

Own Board

Own Keyboard

Own Progress

Players remain inside the same voice room.

Board is private.

Sharing functionality can be added later.

---

# Word Grid

Rows

6

Columns

5

Tile Size

58px

Gap

6px

Animation

Flip Animation

Pop Animation

Shake Animation

Tile Colors

Correct

Green

Present

Yellow

Absent

Dark Gray

Empty

Border Only

---

# Keyboard

Three rows.

Buttons

Rounded Rectangle

Height

52px

Special Keys

Enter

Backspace

Keyboard sticks to bottom.

---

# Navigation

Bottom Navigation

Home

Party

Stats

Settings

Active tab

Green

Inactive

Gray

---

# Cards

Cards should have

Rounded Corners

Small Shadow

Border

Internal Padding

20px

Spacing

16px

---

# Icons

Use Lucide Icons.

Examples

Mic

Mic Off

Users

Share

Settings

Statistics

Back

Copy

Volume

Phone

---

# Animations

Duration

150ms–250ms

Use

Ease In Out

Animations

Button Press

Card Hover

Tile Flip

Tile Bounce

Player Speaking

Bottom Sheet

Modal

Screen Transition

Avoid excessive animation.

---

# Responsive Design

Design mobile first.

Target Width

360px

390px

412px

430px

Tablet support later.

---

# Component Structure

components/

Button/

Card/

Modal/

BottomSheet/

Avatar/

PlayerCard/

RoomCard/

Keyboard/

Tile/

Board/

VoiceControls/

PlayerList/

Lobby/

Header/

BottomNav/

Loading/

Toast/

---

# Design Rules

Always use 8px spacing system.

Never place more than one primary action per screen.

Keep layouts centered.

Avoid clutter.

Maintain high contrast.

Keep typography consistent.

Do not use more than:

- One accent color
- One secondary color

Every screen should feel like part of the same application.

---

# MVP Screens

1. Landing
2. Choose Mode
3. Create Party
4. Join Party
5. Lobby
6. Voice Chat Connected
7. Shared Board
8. Solo Board
9. Individual Multiplayer Board
10. Settings
11. Statistics

---

# Future Screens

- Profile
- Friends
- Invitations
- Match History
- Achievements
- Daily Challenge
- Replay
- Spectator Mode

These are intentionally excluded from the MVP.