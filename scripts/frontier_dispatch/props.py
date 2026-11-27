def pixel_marks():
    """Original 24-pixel inventory illustrations. Each letter is one square of ink."""
    palette = {
        "x": "#171c26", "v": "#303541", "s": "#52606d", "i": "#8495a0",
        "u": "#c1d4d3", "b": "#64432e", "o": "#9a6838", "g": "#c7954c",
        "y": "#f6c768", "l": "#ffe8a0", "p": "#eee0be", "e": "#9d876c",
        "n": "#554266", "a": "#927cab", "m": "#c5add4", "t": "#487861",
        "j": "#92c6a0", "r": "#a56848",
    }
    tiles = {
        "forge": [
            "         xxxxxxxxxxx", "    xxxxxxuuuuuuuuix", "   xuiiiiiiiiiiiiisx",
            "   xxsiisssssssssssx", "     xxisssssssssvx", "       xxssssssvvx",
            "         xxssvvvx", "          xssvvx", "          xssvvx",
            "         xissvvvx", "       xxiiissvvvxx", "      xissssssssevvx",
            "      xxxxxxxxxxxxxx", "      xogbobobbobbx", "      xgoooobbobbbx",
            "      xgboboobbbobx", "      xbbbbbbbbbbbx", "       xxxxxxxxxxx",
        ],
        "balance": [
            "           xx", "          xyyx", "           yx", "         xxxgxx",
            "    xxxxxgyyyyyxxxx", "    xggooooxgoooggyx", "     gx    xg    gx",
            "    g g    yg   g g", "    g g    yg   g g", "   g   g   yg  g   g",
            "   g   g   yg  g   g", "  xyyyygx  yg xyyyygx", "   xgoox   yg  xgoox",
            "    xxx    yg   xxx", "           yg", "          xygo", "        xxgygoxx",
            "       xggyyygoox", "       xxxxxxxxxx",
        ],
        "gate": [
            "   xx             xx", "  xgbx           xgbx", "  xygxxxxxxxxxxxxxogx",
            "  xgoyyyyyyyyyyyyyggx", "  xgogooooooogoooobgx", "  xgoxxxoxxxoxxxxbbgx",
            "  xgoxeogxogexogexbgx", "  xgoxggbxogbxogbxbgx", "  xgoxgbbxogbxogyxbgx",
            "  xgoxgbbxogbxyobxbgx", "  xgoxgbbxogygogbxbgx", "  xgoxgbbxygbxogbxbgx",
            "  xgoxggygoobxogbxbgx", "  xgoxygbxogbxogbxbgx", "  xgogyyyyyyyyyoggbgx",
            "  xgogoooooooogoobbgx", "  xgoxxxxxxxxxxxxxbgx", "  xsbx           xsbx",
            "  xxxx           xxxx",
        ],
        "hook": [
            "       xxxxxx", "      xissssvx", "      xixxxsvx", "      xix  xix",
            "       xx  xix", "          xsssx", "         xissssx", "        xisssssvx",
            "       xuiiiiiisvx", "       xxxxxxxxxxx", "        xgooyyyox", "        xgylllyox",
            "        xglllyyox", "        xglllyyox", "        xglyyygox", "        xgyyyggox",
            "        xggggggox", "       xisssssssxx", "       xuiissssvvx", "        xxxxxxxx",
        ],
        "power": [
            "      xxxxxxxxxxxx", "     xaaammmmmmmmx", "    xnnnnnnnnnnnax",
            "   xammmmmmmmmmmnx", "  xnnnnnnnnnnnnanx", "  xmmmmmmmmmmmanax",
            "  xmaaaaaaaaaanxax", "  xmaannnnnnnanxax", "  xmanannyannanxax",
            "  xmanyyyynnnanxax", "  xmannyyynnnanxax", "  xmanyylyynnanxax",
            "  xmannyyynnnanxax", "  xmannnynnnnanxax", "  xmaannnnnnnanxax",
            "  xmaaaaaaaaaanxax", "  xmmmmmmmmmmmnxax", "  xnnnnnnnnnnnnxxx",
            "  xxxxxxxxxxxxx",
        ],
        "crew": [
            "          xxxx", "         xgoogx", "         xgxxox", "          xyox",
            "       xxxyyygxxx", "      xgyyyyyyggox", "     xgygxxxxxxxgox", "    xgyxlpppppppxgox",
            "    xyxlpxppxppxpxox", "   xgyxpppppxppppxgox", "   xgyxpppppxppppxgox",
            "   xgyxpppppxppppxgox", "   xgyxpxpppxxpppxgox", "   xgyxpppppppxppxgox",
            "    xyxppppppppxpxox", "    xgyxpxppxpppxgox", "     xgyxppppppxgox",
            "      xggxxxxxxgox", "       xggggggoox", "        xxxxxxxx",
        ],
        "referee": [
            "    xxxxxx    xxxxxx", "   xtlppppxx xxlppppx", "  xtplppppppxppppppptx",
            "  xtplppppppxppppppptx", "  xtplpeeeppxppeeepptx", "  xtplppppppxppppppptx",
            "  xtplpeeeeexpppeepptx", "  xtplppppppxppppppptx", "  xtplpeeeppxppeeeeptx",
            "  xtplppppppxppppppptx", "  xtplppeeppxppeeepptx", "  xtplppppppxppppppptx",
            "  xtplppppppxppppppptx", "  xtpeeeppppxppppeeetx", "  xtjjjjjjjpepjjjjjjtx",
            "  xtttttttjjtjjttttttx", "   xxxxxxxjtjtxxxxxxx", "          j j",
        ],
    }
    symbols = []
    for name, rows in tiles.items():
        runs = {}
        top = (24 - len(rows)) // 2
        for y, row in enumerate(rows, top):
            x = 0
            while x < len(row):
                color = row[x]
                end = x + 1
                while end < len(row) and row[end] == color:
                    end += 1
                if color != " ":
                    runs.setdefault(color, []).append(f"M{x} {y}h{end-x}v1H{x}z")
                x = end
        body = "".join(f'<path fill="{palette[ink]}" d="{"".join(commands)}"/>'
                       for ink, commands in runs.items())
        symbols.append(f'<symbol id="prop-{name}" viewBox="0 0 24 24" '
                       f'shape-rendering="crispEdges">{body}</symbol>')
    return "\n".join(symbols)
