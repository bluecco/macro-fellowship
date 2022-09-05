Peer Micro Audit by jkleather

**This document does not indicate a contract audit, its a practice exercise between students for 0xMacro class

File: ProjectFactory.sol

Nothing critical here, rightfully followed the Factory coding pattern. Some minor code improvements:

Line 25:  this can be encapsulated inside Project.sol . This is a code quality issue
Line 13: There is no map to keep relation between owners and projects. Locating project when we know owner requires looping. This is not gas efficient. This is medium

File: Project.sol

All the global variables are "public". This can cause some major security issues. I consider this as a high risk
Line 44: Not needed. Code quality issue.
refund method: Needs to be external. Also contains reentrance potential thread. Reentrance is considered as High risk
withdrawFunds: likewise needs to be external. Also contains reentrance potential thread. Reentrance is considered as High risk


