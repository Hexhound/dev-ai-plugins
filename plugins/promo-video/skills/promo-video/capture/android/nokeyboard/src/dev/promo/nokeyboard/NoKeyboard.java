package dev.promo.nokeyboard;

import android.inputmethodservice.InputMethodService;
import android.view.KeyEvent;
import android.view.inputmethod.InputConnection;

/**
 * An input method that never shows itself. Fields still take focus, the caret still shows and
 * typed keys (adb `input text`) still land; the screen just never gives way to a keyboard.
 *
 * <p>It commits typed characters itself, as a real keyboard does. Left to the app, a typed key
 * takes the window out of touch mode, and the app then wears a focus outline all round.
 */
public class NoKeyboard extends InputMethodService {
    @Override
    public boolean onEvaluateInputViewShown() {
        return false;
    }

    @Override
    public boolean onEvaluateFullscreenMode() {
        return false;
    }

    @Override
    public boolean onShowInputRequested(int flags, boolean configChange) {
        return false;
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        InputConnection ic = getCurrentInputConnection();
        int c = event.getUnicodeChar();
        if (ic != null && c != 0) {
            ic.commitText(new String(Character.toChars(c)), 1);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (getCurrentInputConnection() != null && event.getUnicodeChar() != 0) {
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }
}
