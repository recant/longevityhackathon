"""Full app reset wipes profiles and sessions."""

import pytest

from database import (
    clear_all_app_data,
    create_profile,
    get_profile_by_id,
    list_profiles,
    save_reaction,
)


@pytest.mark.asyncio
async def test_clear_all_app_data_removes_profiles_and_sessions():
    p = await create_profile("Reset Test", 72, "female")
    await save_reaction(p["id"], 250.0, [250.0], {"overall": 80})
    assert await list_profiles()

    counts = await clear_all_app_data()
    assert counts["profiles"] >= 1
    assert counts["reactions"] >= 1
    assert await list_profiles() == []

    with pytest.raises(RuntimeError):
        await get_profile_by_id(p["id"])
