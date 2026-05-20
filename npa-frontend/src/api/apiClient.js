export async function apiFetch(path, options = {}, timeout = 100000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}${path}`, {
            ...options,
            signal: controller.signal,
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || `API error: ${res.status}`);
        }
        return await res.json();
    } catch (err) {
        if (err.name === "AbortError") {
            throw new Error("Request timed out");
        }
        throw err;
    } finally {
        clearTimeout(id);
    }
}