package org.haiyue.share;

/** Separate manifest identity avoids collisions with other plugins' FileProviders. */
public final class HaiyueShareProvider extends androidx.core.content.FileProvider {
    public HaiyueShareProvider() { super(); }
}
